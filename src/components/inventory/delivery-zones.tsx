"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  is_active: boolean;
}

export function DeliveryZones() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneFee, setNewZoneFee] = useState("");
  
  const supabase = createClient();

  useEffect(() => {
    fetchZones();
  }, []);

  async function fetchZones() {
    setIsLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Get current user's account_id via member profile
    const { data: memberData } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", userData.user.id)
      .single();

    if (!memberData) return;

    const { data, error } = await supabase
      .from("delivery_zones")
      .select("*")
      .eq("account_id", memberData.account_id)
      .order("name");

    if (error) {
      toast.error(`Error fetching zones: ${error.message}`);
    } else {
      setZones(data || []);
    }
    setIsLoading(false);
  }

  async function handleAddZone(e: React.FormEvent) {
    e.preventDefault();
    if (!newZoneName || !newZoneFee) return;

    setIsSubmitting(true);
    
    const { data: userData } = await supabase.auth.getUser();
    const { data: memberData } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", userData.user?.id)
      .single();

    if (!memberData) {
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from("delivery_zones").insert({
      account_id: memberData.account_id,
      name: newZoneName,
      fee: parseFloat(newZoneFee),
      is_active: true
    });

    setIsSubmitting(false);

    if (error) {
      toast.error(`Failed to add zone: ${error.message}`);
    } else {
      toast.success("Delivery zone has been created.");
      setNewZoneName("");
      setNewZoneFee("");
      fetchZones();
    }
  }

  async function handleDeleteZone(id: string) {
    const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
    if (error) {
      toast.error(`Failed to delete zone: ${error.message}`);
    } else {
      toast.success("Delivery zone has been removed.");
      fetchZones();
    }
  }

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Add Delivery Zone</CardTitle>
          <CardDescription>Configure common delivery locations and flat-rate fees.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddZone} className="flex gap-4 items-end">
            <div className="space-y-2 flex-1">
              <Label htmlFor="name">Zone Name (e.g., Nairobi CBD)</Label>
              <Input
                id="name"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Zone name"
                required
              />
            </div>
            <div className="space-y-2 flex-1">
              <Label htmlFor="fee">Delivery Fee (KES)</Label>
              <Input
                id="fee"
                type="number"
                min="0"
                step="0.01"
                value={newZoneFee}
                onChange={(e) => setNewZoneFee(e.target.value)}
                placeholder="e.g., 200"
                required
              />
            </div>
            <Button type="submit" disabled={isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Zone
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Active Zones</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : zones.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No delivery zones configured yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Fee (KES)</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell className="font-medium">{zone.name}</TableCell>
                    <TableCell>{zone.fee}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                        onClick={() => handleDeleteZone(zone.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
