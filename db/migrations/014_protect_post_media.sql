-- STEP9-4: prevent any media referenced by a post from entering trash
-- or being physically deleted. Locks coordinate with save_post() FOR UPDATE.
-- Execute after 013_save_post.sql, before deploying STEP9-4 Backend.
BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_linked_post_media_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     OR (TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
    IF EXISTS (
      SELECT 1 FROM public.post_media pm
      WHERE pm.media_id = OLD.id
    ) THEN
      RAISE EXCEPTION 'media_in_use' USING ERRCODE = '23503';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS media_post_reference_protect ON public.media;

CREATE TRIGGER media_post_reference_protect
BEFORE UPDATE OF deleted_at OR DELETE ON public.media
FOR EACH ROW
EXECUTE FUNCTION public.prevent_linked_post_media_deletion();

COMMIT;
