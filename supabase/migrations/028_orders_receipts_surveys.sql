-- Migration: Orders, Receipts, and Surveys
-- Description: Table schemas to track complete orders, their receipt status via WhatsApp, and configurable survey modules.

-- ============================================================
-- 1. ORDERS TABLE
-- ============================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    delivery_address TEXT,
    delivery_fee NUMERIC(10, 2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'delivered', 'cancelled')),
    receipt_status TEXT NOT NULL DEFAULT 'pending' CHECK (receipt_status IN ('pending', 'sent', 'failed')),
    receipt_message_id TEXT,
    receipt_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for orders querying
CREATE INDEX idx_orders_account_id ON orders(account_id);
CREATE INDEX idx_orders_contact_id ON orders(contact_id);
CREATE INDEX idx_orders_status ON orders(status);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to orders"
    ON orders FOR ALL TO authenticated
    USING (is_account_member(account_id, 'admin'))
    WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY "Members can view orders"
    ON orders FOR SELECT TO authenticated
    USING (is_account_member(account_id, 'viewer'));

-- ============================================================
-- 2. UPDATE MPESA TRANSACTIONS
-- ============================================================
ALTER TABLE mpesa_transactions ADD COLUMN order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

-- ============================================================
-- 3. SURVEY CONFIG
-- ============================================================
CREATE TABLE survey_config (
    account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT false,
    question_text TEXT NOT NULL DEFAULT 'How was your experience with our product? Reply 1-5 (1=Poor, 5=Excellent).',
    delay_days INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE survey_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to survey_config"
    ON survey_config FOR ALL TO authenticated
    USING (is_account_member(account_id, 'admin'))
    WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY "Members can view survey_config"
    ON survey_config FOR SELECT TO authenticated
    USING (is_account_member(account_id, 'viewer'));

-- ============================================================
-- 4. SURVEY RESPONSES
-- ============================================================
CREATE TABLE survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    response_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_survey_responses_account_id ON survey_responses(account_id);
CREATE INDEX idx_survey_responses_contact_id ON survey_responses(contact_id);

ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to survey_responses"
    ON survey_responses FOR ALL TO authenticated
    USING (is_account_member(account_id, 'admin'))
    WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY "Members can view survey_responses"
    ON survey_responses FOR SELECT TO authenticated
    USING (is_account_member(account_id, 'viewer'));

-- Trigger to update updated_at timestamps
CREATE TRIGGER set_updated_at_orders
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_survey_config
    BEFORE UPDATE ON survey_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
