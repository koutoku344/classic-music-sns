-- STEP11-3-5: notifications for newly inserted feedback only.
-- Prerequisite: migrations for posts/comments/likes and 019_notifications.
-- This migration does not rewrite historical feedback or notifications.
-- Trigger code runs in the SAME transaction as the original feedback insert.
BEGIN;

CREATE OR REPLACE FUNCTION public.notify_new_post_comment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_post_owner UUID;
  v_reply_owner UUID;
BEGIN
  SELECT p.user_id INTO v_post_owner
  FROM public.posts p WHERE p.id = NEW.post_id;

  IF NEW.reply_to_comment_id IS NOT NULL THEN
    SELECT c.user_id INTO v_reply_owner
    FROM public.post_comments c
    WHERE c.id = NEW.reply_to_comment_id
      AND c.post_id = NEW.post_id;

    IF v_reply_owner IS NOT NULL AND v_reply_owner <> NEW.user_id THEN
      INSERT INTO public.notifications (
        recipient_user_id, actor_user_id, type, event_key, post_id, comment_id
      ) VALUES (
        v_reply_owner, NEW.user_id, 'comment_reply',
        'comment-reply:' || NEW.id::text || ':' || v_reply_owner::text,
        NEW.post_id, NEW.id
      ) ON CONFLICT (event_key) DO NOTHING;
    END IF;
  END IF;

  -- A post owner gets a post-comment notification except when:
  -- (a) author is the owner; (b) they already got the reply notification.
  IF v_post_owner IS NOT NULL AND v_post_owner <> NEW.user_id
     AND v_post_owner IS DISTINCT FROM v_reply_owner THEN
    INSERT INTO public.notifications (
      recipient_user_id, actor_user_id, type, event_key, post_id, comment_id
    ) VALUES (
      v_post_owner, NEW.user_id, 'post_comment',
      'post-comment:' || NEW.id::text,
      NEW.post_id, NEW.id
    ) ON CONFLICT (event_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_post_comment_insert ON public.post_comments;

CREATE TRIGGER notify_post_comment_insert
AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_new_post_comment();


CREATE OR REPLACE FUNCTION public.notify_new_post_like()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_post_owner UUID;
BEGIN
  SELECT p.user_id INTO v_post_owner
  FROM public.posts p WHERE p.id = NEW.post_id;

  IF v_post_owner IS NOT NULL AND v_post_owner <> NEW.user_id THEN
    INSERT INTO public.notifications (
      recipient_user_id, actor_user_id, type, event_key, post_id
    ) VALUES (
      v_post_owner, NEW.user_id, 'post_like',
      'post-like:' || gen_random_uuid()::text,
      NEW.post_id
    ) ON CONFLICT (event_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_post_like_insert ON public.post_likes;

CREATE TRIGGER notify_post_like_insert
AFTER INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_new_post_like();


CREATE OR REPLACE FUNCTION public.notify_new_comment_like()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_comment_owner UUID;
  v_post_id UUID;
BEGIN
  SELECT c.user_id, c.post_id INTO v_comment_owner, v_post_id
  FROM public.post_comments c
  WHERE c.id = NEW.comment_id AND c.deleted_at IS NULL;

  IF v_comment_owner IS NOT NULL AND v_comment_owner <> NEW.user_id THEN
    INSERT INTO public.notifications (
      recipient_user_id, actor_user_id, type, event_key, post_id, comment_id
    ) VALUES (
      v_comment_owner, NEW.user_id, 'comment_like',
      'comment-like:' || gen_random_uuid()::text,
      v_post_id, NEW.comment_id
    ) ON CONFLICT (event_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_comment_like_insert ON public.post_comment_likes;

CREATE TRIGGER notify_comment_like_insert
AFTER INSERT ON public.post_comment_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_new_comment_like();

COMMIT;
