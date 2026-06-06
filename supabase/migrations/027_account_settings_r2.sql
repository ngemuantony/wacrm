-- ============================================================
-- ACCOUNT SETTINGS & R2 MIGRATION
-- Adds settings for Daraja M-Pesa Integration and Rate Limits
-- ============================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS daraja_consumer_key TEXT,
  ADD COLUMN IF NOT EXISTS daraja_consumer_secret TEXT,
  ADD COLUMN IF NOT EXISTS daraja_passkey TEXT,
  ADD COLUMN IF NOT EXISTS daraja_shortcode TEXT,
  ADD COLUMN IF NOT EXISTS daraja_type TEXT DEFAULT 'paybill' CHECK (daraja_type IN ('paybill', 'till')),
  ADD COLUMN IF NOT EXISTS mpesa_webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS meta_rate_limit INT DEFAULT 250;
