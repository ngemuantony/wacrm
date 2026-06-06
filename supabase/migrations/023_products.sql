-- Migration: Products (Inventory) Table
-- Description: E-commerce inventory matching table.

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    image_url TEXT,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for searching and filtering
CREATE INDEX idx_products_account_id ON products(account_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_is_active ON products(is_active);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Admins can do everything for their account
CREATE POLICY "Admins have full access to products"
    ON products FOR ALL TO authenticated
    USING (is_account_member(account_id, 'admin'))
    WITH CHECK (is_account_member(account_id, 'admin'));

-- Viewers and Agents can view products
CREATE POLICY "Members can view products"
    ON products FOR SELECT TO authenticated
    USING (is_account_member(account_id, 'viewer'));

-- Trigger to update 'updated_at'
CREATE TRIGGER set_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
