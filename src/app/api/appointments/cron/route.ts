import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'
import { differenceInHours, differenceInMinutes, format } from 'date-fns'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
  try {
    // Only fetch scheduled appointments
    const { data: appointments, error } = await supabaseAdmin
      .from('appointments')
      .select('*, contact:contacts(*)')
      .eq('status', 'scheduled')

    if (error || !appointments) {
      console.error('Failed to fetch appointments:', error)
      return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 })
    }

    const now = new Date()

    for (const appt of appointments) {
      const startTime = new Date(appt.start_time)
      const hoursToAppt = differenceInHours(startTime, now)
      const minsToAppt = differenceInMinutes(startTime, now)

      let reminderType = null
      
      // Check 24 hours (between 23.5 and 24.5 hours to avoid double sending if cron runs every few mins)
      if (hoursToAppt === 24 && !appt.reminders_sent?.includes('24h')) {
        reminderType = '24h'
      } 
      // Check 1 hour (between 55 and 65 mins)
      else if (minsToAppt > 55 && minsToAppt <= 65 && !appt.reminders_sent?.includes('1h')) {
        reminderType = '1h'
      }

      if (reminderType && appt.contact?.phone) {
        // Find user config
        const { data: config } = await supabaseAdmin
          .from('whatsapp_config')
          .select('*')
          .eq('user_id', appt.user_id)
          .single()

        if (config && config.status === 'connected') {
          const accessToken = decrypt(config.access_token)
          const timeFormatted = format(startTime, 'PPp')
          const textMessage = `Reminder: You have an upcoming appointment "${appt.title}" scheduled for ${timeFormatted}.`

          try {
            await sendTextMessage({
              phoneNumberId: config.phone_number_id,
              accessToken,
              to: appt.contact.phone,
              text: textMessage
            })

            // Mark reminder as sent
            const updatedReminders = [...(appt.reminders_sent || []), reminderType]
            await supabaseAdmin
              .from('appointments')
              .update({ reminders_sent: updatedReminders })
              .eq('id', appt.id)

            // Find or create conversation to log message
            const { data: conv } = await supabaseAdmin
              .from('conversations')
              .select('id')
              .eq('contact_id', appt.contact.id)
              .single()

            if (conv) {
              await supabaseAdmin.from('messages').insert({
                conversation_id: conv.id,
                sender_type: 'bot',
                content_type: 'text',
                content_text: textMessage,
                status: 'sent',
              })
            }
          } catch (err) {
            console.error(`Failed to send ${reminderType} reminder to ${appt.contact.phone}`, err)
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Appointments cron error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
