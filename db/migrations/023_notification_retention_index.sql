-- STEP11-3-7: index for bounded daily retention of read notifications.
-- Apply before deploying the scheduled cleanup code.
-- This does NOT delete or update any notifications.
-- Unread entries have read_at NULL and are intentionally excluded.
BEGIN;

CREATE INDEX IF NOT EXISTS notifications_read_retention_idx
  ON public.notifications (read_at ASC, id ASC)
  WHERE read_at IS NOT NULL;

COMMIT;
