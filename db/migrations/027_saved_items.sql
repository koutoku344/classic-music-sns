-- STEP15: save public posts and recruitments without duplicating content.
BEGIN;
CREATE TABLE IF NOT EXISTS public.saved_items (
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 item_type text NOT NULL CHECK (item_type IN ('post','recruitment')),
 item_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,item_type,item_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_items_owner_recent ON public.saved_items(user_id,created_at DESC,item_id);
COMMIT;
