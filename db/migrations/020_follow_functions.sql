-- STEP11-3-1: atomic follow request/approval/rejection/removal + follow notifications.
-- Prerequisite: migration 019 applied. No changes to existing posts, media or comments.
-- API must pass actor UUID derived from verified Clerk token, never from request body.
BEGIN;

-- A single transaction must serialize follow changes by the target profile row.
-- Each user profile already exists only after profile setup.
CREATE OR REPLACE FUNCTION public.request_follow(
  p_actor UUID,
  p_target UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_visibility VARCHAR(20);
  v_follow public.follows%ROWTYPE;
  v_status VARCHAR(16);
  v_new BOOLEAN := false;
BEGIN
  IF p_actor IS NULL OR p_target IS NULL OR p_actor = p_target THEN
    RAISE EXCEPTION 'invalid_follow' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_actor AND length(btrim(display_name)) > 0
  ) THEN
    RAISE EXCEPTION 'profile_required' USING ERRCODE = '22023';
  END IF;

  -- All operations on this target (including accepting/rejecting/removing)
  -- first lock the target profile to serialize concurrent transitions.
  SELECT visibility INTO v_visibility
  FROM public.profiles
  WHERE user_id = p_target AND length(btrim(display_name)) > 0
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = '22023';
  END IF;

  v_status := CASE WHEN v_visibility = 'public'
    THEN 'accepted' ELSE 'pending' END;

  SELECT * INTO v_follow
  FROM public.follows
  WHERE follower_id = p_actor AND followee_id = p_target
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.follows (
      follower_id, followee_id, status, accepted_at
    ) VALUES (
      p_actor, p_target, v_status,
      CASE WHEN v_status = 'accepted' THEN clock_timestamp() ELSE NULL END
    )
    RETURNING * INTO v_follow;
    v_new := true;
  ELSIF v_follow.status = 'rejected' THEN
    UPDATE public.follows
    SET status = v_status,
        requested_at = clock_timestamp(),
        accepted_at = CASE WHEN v_status = 'accepted'
          THEN clock_timestamp() ELSE NULL END,
        rejected_at = NULL,
        updated_at = clock_timestamp()
    WHERE id = v_follow.id
    RETURNING * INTO v_follow;
    v_new := true;
  END IF;

  IF v_new THEN
    INSERT INTO public.notifications (
      recipient_user_id, actor_user_id, type, event_key, follow_id
    ) VALUES (
      p_target,
      p_actor,
      CASE WHEN v_follow.status = 'accepted' THEN 'follow' ELSE 'follow_request' END,
      'follow-start:' || v_follow.id::text || ':' ||
        extract(epoch from v_follow.requested_at)::text,
      v_follow.id
    )
    ON CONFLICT (event_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'id', v_follow.id,
    'status', v_follow.status,
    'changed', v_new
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_follow(
  p_actor UUID,
  p_follow_id UUID,
  p_accept BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_target UUID;
  v_follow public.follows%ROWTYPE;
  v_changed BOOLEAN := false;
BEGIN
  IF p_actor IS NULL OR p_follow_id IS NULL OR p_accept IS NULL THEN
    RAISE EXCEPTION 'invalid_follow' USING ERRCODE = '22023';
  END IF;

  -- Read only the target ID first. Follow row cannot be changed without first
  -- locking its target profile in all STEP11 follow functions.
  SELECT followee_id INTO v_target
  FROM public.follows
  WHERE id = p_follow_id;
  IF NOT FOUND OR v_target <> p_actor THEN
    RAISE EXCEPTION 'follow_not_found' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.profiles WHERE user_id = p_actor FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'follow_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_follow FROM public.follows
  WHERE id = p_follow_id AND followee_id = p_actor
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'follow_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_follow.status = 'pending' THEN
    UPDATE public.follows
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
        accepted_at = CASE WHEN p_accept THEN clock_timestamp() ELSE NULL END,
        rejected_at = CASE WHEN p_accept THEN NULL ELSE clock_timestamp() END,
        updated_at = clock_timestamp()
    WHERE id = p_follow_id
    RETURNING * INTO v_follow;
    v_changed := true;

    IF p_accept THEN
      INSERT INTO public.notifications (
        recipient_user_id, actor_user_id, type, event_key, follow_id
      ) VALUES (
        v_follow.follower_id,
        p_actor,
        'follow_accepted',
        'follow-accepted:' || v_follow.id::text || ':' ||
          extract(epoch from v_follow.accepted_at)::text,
        v_follow.id
      )
      ON CONFLICT (event_key) DO NOTHING;
    END IF;
  ELSIF (v_follow.status = 'accepted' AND p_accept)
     OR (v_follow.status = 'rejected' AND NOT p_accept) THEN
    -- Repeated same response is idempotent.
    NULL;
  ELSE
    RAISE EXCEPTION 'follow_conflict' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'id', v_follow.id,
    'status', v_follow.status,
    'changed', v_changed
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_follow(
  p_actor UUID,
  p_other_user UUID,
  p_remove_follower BOOLEAN DEFAULT FALSE
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_followee UUID;
  v_follower UUID;
  v_deleted UUID;
BEGIN
  IF p_actor IS NULL OR p_other_user IS NULL
     OR p_actor = p_other_user OR p_remove_follower IS NULL THEN
    RAISE EXCEPTION 'invalid_follow' USING ERRCODE = '22023';
  END IF;

  -- Remove own outgoing relation, or remove an incoming accepted follower.
  v_followee := CASE WHEN p_remove_follower THEN p_actor ELSE p_other_user END;
  v_follower := CASE WHEN p_remove_follower THEN p_other_user ELSE p_actor END;

  PERFORM 1 FROM public.profiles WHERE user_id = v_followee FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'follow_not_found' USING ERRCODE = '22023';
  END IF;

  IF p_remove_follower THEN
    DELETE FROM public.follows
    WHERE follower_id = v_follower AND followee_id = v_followee
      AND status = 'accepted'
    RETURNING id INTO v_deleted;
  ELSE
    DELETE FROM public.follows
    WHERE follower_id = v_follower AND followee_id = v_followee
      AND status IN ('pending', 'accepted')
    RETURNING id INTO v_deleted;
  END IF;

  -- Idempotent when there is no outgoing request/follow or accepted follower.
  -- A rejected row is intentionally kept until the actor retries or expires.
  RETURN v_deleted IS NOT NULL;
END;
$$;

COMMIT;
