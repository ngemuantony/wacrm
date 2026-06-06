'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Loader2, Shield, Eye, EyeOff, Copy } from 'lucide-react';

export function IntegrationsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [passkey, setPasskey] = useState('');
  const [shortcode, setShortcode] = useState('');
  const [darajaType, setDarajaType] = useState('paybill');
  const [rateLimit, setRateLimit] = useState('250');
  
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);

  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showPasskey, setShowPasskey] = useState(false);

  useEffect(() => {
    fetch('/api/settings/integrations')
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          // If they exist, we just show a placeholder so the user knows they are set
          if (data.hasConsumerKey) setConsumerKey('••••••••••••••••');
          if (data.hasConsumerSecret) setConsumerSecret('••••••••••••••••');
          if (data.hasPasskey) setPasskey('••••••••••••••••');
          
          setShortcode(data.daraja_shortcode || '');
          setDarajaType(data.daraja_type || 'paybill');
          setRateLimit(data.meta_rate_limit?.toString() || '250');
          setWebhookSecret(data.mpesa_webhook_secret);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    
    // Only send the values if they were actually changed from the placeholder
    const payload: Record<string, string> = {
      daraja_shortcode: shortcode,
      daraja_type: darajaType,
      meta_rate_limit: rateLimit
    };

    if (consumerKey && consumerKey !== '••••••••••••••••') payload.daraja_consumer_key = consumerKey;
    if (consumerSecret && consumerSecret !== '••••••••••••••••') payload.daraja_consumer_secret = consumerSecret;
    if (passkey && passkey !== '••••••••••••••••') payload.daraja_passkey = passkey;

    try {
      const res = await fetch('/api/settings/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Integrations updated successfully');
        // Fetch again to get the generated webhook secret if it was just created
        const getRes = await fetch('/api/settings/integrations');
        const getData = await getRes.json();
        if (getData.mpesa_webhook_secret) {
          setWebhookSecret(getData.mpesa_webhook_secret);
        }
      } else {
        toast.error(data.error || 'Failed to update integrations');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  }

  function copyWebhook() {
    if (!webhookSecret) return;
    const url = `${window.location.origin}/api/mpesa/webhook/${webhookSecret}`;
    navigator.clipboard.writeText(url);
    toast.success('Webhook URL copied to clipboard');
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Daraja M-Pesa Settings */}
      <div className="rounded-xl border border-border bg-card/80 p-6 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-semibold text-foreground">Daraja M-Pesa Integration</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Configure your M-Pesa API credentials. These are encrypted at rest for maximum security.
        </p>

        <div className="space-y-4">
          <div>
            <Label>Type</Label>
            <RadioGroup 
              value={darajaType} 
              onValueChange={setDarajaType}
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="paybill" id="paybill" />
                <Label htmlFor="paybill">Paybill</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="till" id="till" />
                <Label htmlFor="till">Buy Goods (Till)</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label>Shortcode / Till Number</Label>
            <Input 
              value={shortcode}
              onChange={(e) => setShortcode(e.target.value)}
              placeholder="e.g. 174379"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Consumer Key</Label>
            <div className="relative mt-1">
              <Input 
                type={showKey ? "text" : "password"}
                value={consumerKey}
                onChange={(e) => setConsumerKey(e.target.value)}
                className="pr-10"
              />
              <button 
                type="button"
                className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label>Consumer Secret</Label>
            <div className="relative mt-1">
              <Input 
                type={showSecret ? "text" : "password"}
                value={consumerSecret}
                onChange={(e) => setConsumerSecret(e.target.value)}
                className="pr-10"
              />
              <button 
                type="button"
                className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label>Passkey</Label>
            <div className="relative mt-1">
              <Input 
                type={showPasskey ? "text" : "password"}
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                className="pr-10"
              />
              <button 
                type="button"
                className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground"
                onClick={() => setShowPasskey(!showPasskey)}
              >
                {showPasskey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {webhookSecret && (
            <div className="mt-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Label className="text-emerald-700 dark:text-emerald-400">Secure Webhook URL</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Register this URL in your Safaricom Daraja App settings to receive payment confirmations. This URL is uniquely secured for your account.
              </p>
              <div className="flex items-center gap-2">
                <code className="text-xs flex-1 bg-background p-2 rounded border border-border overflow-hidden text-ellipsis whitespace-nowrap">
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/mpesa/webhook/${webhookSecret}` : ''}
                </code>
                <Button variant="outline" size="icon" onClick={copyWebhook}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Meta API Settings */}
      <div className="rounded-xl border border-border bg-card/80 p-6 shadow-lg backdrop-blur-md">
        <h2 className="text-lg font-semibold text-foreground mb-4">API Rate Limits</h2>
        
        <div>
          <Label>Meta API Daily Contact Limit</Label>
          <p className="text-xs text-muted-foreground mt-1 mb-2">
            The maximum number of contacts you are allowed to message per day. This limit is enforced for bulk broadcasts.
          </p>
          <Input 
            type="number"
            value={rateLimit}
            onChange={(e) => setRateLimit(e.target.value)}
            className="max-w-[200px]"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
