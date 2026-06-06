-- Migration: Delivery Zones
-- Description: Tracking delivery locations and custom fees for e-commerce.

CREATE TABLE delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying zones by account
CREATE INDEX idx_delivery_zones_account_id ON delivery_zones(account_id);

-- Enable RLS
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

-- Admins can view/manage
CREATE POLICY "Admins have full access to delivery_zones"
    ON delivery_zones FOR ALL TO authenticated
    USING (is_account_member(account_id, 'admin'))
    WITH CHECK (is_account_member(account_id, 'admin'));

-- Viewers and Agents can view
CREATE POLICY "Members can view delivery_zones"
    ON delivery_zones FOR SELECT TO authenticated
    USING (is_account_member(account_id, 'viewer'));

-- Update existing ecommerce_checkouts to track delivery
ALTER TABLE ecommerce_checkouts ADD COLUMN delivery_location TEXT;
ALTER TABLE ecommerce_checkouts ADD COLUMN delivery_fee NUMERIC(10, 2);
