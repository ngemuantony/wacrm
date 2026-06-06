-- Migration: Ecommerce Checkouts
-- Description: Tracking active checkout sessions for M-Pesa.

CREATE TABLE ecommerce_checkouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending_number',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quickly looking up active checkouts for a contact
CREATE INDEX idx_ecommerce_checkouts_contact_id ON ecommerce_checkouts(contact_id);

-- Enable RLS
ALTER TABLE ecommerce_checkouts ENABLE ROW LEVEL SECURITY;

-- Admins can view/manage
CREATE POLICY "Admins have full access to ecommerce_checkouts"
    ON ecommerce_checkouts FOR ALL TO authenticated
    USING (is_account_member(account_id, 'admin'))
    WITH CHECK (is_account_member(account_id, 'admin'));

-- Viewers and Agents can view
CREATE POLICY "Members can view ecommerce_checkouts"
    ON ecommerce_checkouts FOR SELECT TO authenticated
    USING (is_account_member(account_id, 'viewer'));
