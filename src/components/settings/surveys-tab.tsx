"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function SurveysTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    is_active: false,
    question_text: "How was your experience with our product? Reply 1-5 (1=Poor, 5=Excellent).",
    delay_days: 3,
  });

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/settings/surveys");
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            setConfig(data.config);
          }
        }
      } catch (error) {
        toast.error("Failed to load survey configuration");
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Survey settings updated successfully!");
        setConfig(data.config);
      } else {
        toast.error(data.error || "Failed to update settings");
      }
    } catch (error) {
      toast.error("An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-medium">Feedback Surveys</h3>
        <p className="text-sm text-muted-foreground">
          Configure automated feedback surveys to be sent via WhatsApp after a successful order.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4 bg-card/50 backdrop-blur-sm">
          <div className="space-y-0.5">
            <Label className="text-base">Enable Automatic Surveys</Label>
            <p className="text-sm text-muted-foreground">
              Automatically send a survey message to customers after they complete an order.
            </p>
          </div>
          <Switch 
            checked={config.is_active} 
            onCheckedChange={(c) => setConfig({ ...config, is_active: c })} 
          />
        </div>

        {config.is_active && (
          <div className="space-y-4 border rounded-lg p-4 bg-card/50 backdrop-blur-sm">
            <div className="space-y-2">
              <Label>Delay (Days)</Label>
              <Input 
                type="number" 
                min={0}
                max={30}
                value={config.delay_days}
                onChange={(e) => setConfig({ ...config, delay_days: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                How many days after an order is paid/delivered should the survey be sent?
              </p>
            </div>

            <div className="space-y-2">
              <Label>Survey Message</Label>
              <Textarea 
                rows={4}
                value={config.question_text}
                onChange={(e) => setConfig({ ...config, question_text: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                The exact WhatsApp message that will be sent to the customer.
              </p>
            </div>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Survey Settings
        </Button>
      </div>
    </div>
  );
}
