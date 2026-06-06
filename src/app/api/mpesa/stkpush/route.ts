import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { amount, phone_number, contact_id } = body

    if (!amount || !phone_number || !contact_id) {
      return NextResponse.json(
        { error: 'amount, phone_number, and contact_id are required' },
        { status: 400 }
      )
    }

    const consumerKey = process.env.MPESA_CONSUMER_KEY
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET
    const passkey = process.env.MPESA_PASSKEY
    const shortcode = process.env.MPESA_SHORTCODE
    const environment = process.env.MPESA_ENVIRONMENT || 'sandbox'
    
    if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
      return NextResponse.json(
        { error: 'M-Pesa credentials not configured in environment variables' },
        { status: 500 }
      )
    }

    const baseUrl =
      environment === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke'

    // 1. Get Auth Token
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
    const authRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    })

    if (!authRes.ok) {
      const errTxt = await authRes.text()
      console.error('M-Pesa auth failed', errTxt)
      return NextResponse.json({ error: 'Failed to authenticate with M-Pesa' }, { status: 500 })
    }

    const { access_token } = await authRes.json()

    // 2. STK Push
    const timestamp = format(new Date(), 'yyyyMMddHHmmss')
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64')
    
    // Formatting phone: Daraja requires 254...
    let mpesaPhone = phone_number.replace(/\D/g, '')
    if (mpesaPhone.startsWith('0')) mpesaPhone = '254' + mpesaPhone.slice(1)
    if (mpesaPhone.startsWith('+')) mpesaPhone = mpesaPhone.slice(1)

    const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://tuinnov8.ngrok.app'}/api/mpesa/webhook`

    const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.floor(amount),
        PartyA: mpesaPhone,
        PartyB: shortcode,
        PhoneNumber: mpesaPhone,
        CallBackURL: callbackUrl,
        AccountReference: 'Tuinnov8 CRM',
        TransactionDesc: 'Payment Request',
      }),
    })

    const stkData = await stkRes.json()

    if (!stkRes.ok || stkData.errorCode) {
      console.error('M-Pesa STK Push failed:', stkData)
      return NextResponse.json(
        { error: stkData.errorMessage || 'STK Push Failed' },
        { status: 400 }
      )
    }

    // 3. Save to database
    const { error: dbError } = await supabase
      .from('mpesa_transactions')
      .insert({
        user_id: user.id,
        contact_id,
        amount,
        phone_number: mpesaPhone,
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id: stkData.MerchantRequestID,
        status: 'pending',
      })

    if (dbError) {
      console.error('Failed to save mpesa transaction:', dbError)
      return NextResponse.json({ error: 'Failed to save transaction locally' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: stkData })
  } catch (error) {
    console.error('M-Pesa error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
