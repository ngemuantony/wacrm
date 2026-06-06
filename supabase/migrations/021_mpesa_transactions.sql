-- ============================================================
-- MPESA TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  phone_number TEXT NOT NULL,
  checkout_request_id TEXT UNIQUE NOT NULL,
  merchant_request_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  receipt_number TEXT UNIQUE,
  result_desc TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_user_id ON mpesa_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_contact_id ON mpesa_transactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_checkout_request_id ON mpesa_transactions(checkout_request_id);

ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own mpesa transactions" ON mpesa_transactions;
CREATE POLICY "Users can manage own mpesa transactions" ON mpesa_transactions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage mpesa transactions" ON mpesa_transactions;
CREATE POLICY "Service role can manage mpesa transactions" ON mpesa_transactions FOR ALL USING (true);

-- Add to updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON mpesa_transactions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON mpesa_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
