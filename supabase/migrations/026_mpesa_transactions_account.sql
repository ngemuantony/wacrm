-- Migration: M-Pesa Transactions Account Link
-- Description: Add account_id to mpesa_transactions to support RBAC and dashboard filtering

ALTER TABLE mpesa_transactions ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

-- Backfill account_id based on contact_id (if contact exists)
UPDATE mpesa_transactions mt
SET account_id = c.account_id
FROM contacts c
WHERE mt.contact_id = c.id;

-- Now create an index
CREATE INDEX idx_mpesa_transactions_account_id ON mpesa_transactions(account_id);

-- Update RLS policies for administrative access
DROP POLICY IF EXISTS "Admins have full access to mpesa_transactions" ON mpesa_transactions;
CREATE POLICY "Admins have full access to mpesa_transactions"
    ON mpesa_transactions FOR ALL TO authenticated
    USING (is_account_member(account_id, 'admin'))
    WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS "Members can view mpesa_transactions" ON mpesa_transactions;
CREATE POLICY "Members can view mpesa_transactions"
    ON mpesa_transactions FOR SELECT TO authenticated
    USING (is_account_member(account_id, 'viewer'));
