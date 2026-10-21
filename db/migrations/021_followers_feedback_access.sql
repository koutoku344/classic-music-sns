-- STEP11-3-3: Keep profile gate, add accepted followers visibility to feedback writes.
-- Replaces current 018 feedback functions after 019 and 020 are applied.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_post_comment(
  p_user_id UUID,
  p_post_id UUID,
  p_body TEXT,
  p_audio_timestamp_seconds INTEGER,
  p_reply_to_comment_id UUID
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_post public.posts%ROWTYPE;
  v_target public.post_comments%ROWTYPE;
  v_root public.post_comments%ROWTYPE;
  v_parent UUID;
  v_comment UUID;
  v_duration INTEGER;
  v_has_audio BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id AND length(btrim(display_name)) > 0
  ) THEN
    RAISE EXCEPTION 'profile_required' USING ERRCODE = '22023';
  END IF;

  -- Every comment writer must have access to the post.
  -- Lock coordinates with save_post() and post deletion, and serializes writes.
  SELECT p.* INTO v_post
  FROM public.posts p
  JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE p.id = p_post_id
    AND (
      pr.visibility = 'public'
      OR p.user_id = p_user_id
      OR (
        pr.visibility = 'followers'
        AND EXISTS (
          SELECT 1
          FROM public.follows f
          WHERE f.follower_id = p_user_id
            AND f.followee_id = p.user_id
            AND f.status = 'accepted'
        )
      )
    )
  FOR UPDATE OF p;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'post_not_found' USING ERRCODE = '22023';
  END IF;
  IF NOT v_post.comments_enabled THEN
    RAISE EXCEPTION 'comments_disabled' USING ERRCODE = '22023';
  END IF;

  IF p_user_id IS NULL OR p_body IS NULL OR
     length(p_body) NOT BETWEEN 1 AND 1000 OR p_body <> btrim(p_body) THEN
    RAISE EXCEPTION 'invalid_comment' USING ERRCODE = '22023';
  END IF;

  IF p_reply_to_comment_id IS NOT NULL THEN
    IF p_audio_timestamp_seconds IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_timestamp' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_target
    FROM public.post_comments
    WHERE id = p_reply_to_comment_id AND post_id = p_post_id
    FOR UPDATE;
    IF NOT FOUND OR v_target.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'comment_not_found' USING ERRCODE = '22023';
    END IF;

    v_parent := COALESCE(v_target.parent_comment_id, v_target.id);
    SELECT * INTO v_root
    FROM public.post_comments
    WHERE id = v_parent AND post_id = p_post_id
    FOR UPDATE;
    IF NOT FOUND OR v_root.parent_comment_id IS NOT NULL
       OR v_root.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'comment_not_found' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_audio_timestamp_seconds IS NOT NULL THEN
      IF p_audio_timestamp_seconds < 0 THEN
        RAISE EXCEPTION 'invalid_timestamp' USING ERRCODE = '22023';
      END IF;
      SELECT EXISTS (
        SELECT 1 FROM public.post_media pm
        JOIN public.media m ON m.id = pm.media_id
        WHERE pm.post_id = p_post_id AND m.media_type = 'audio'
          AND m.upload_status = 'ready' AND m.deleted_at IS NULL
      ) INTO v_has_audio;
      SELECT m.duration_seconds INTO v_duration
      FROM public.post_media pm
      JOIN public.media m ON m.id = pm.media_id
      WHERE pm.post_id = p_post_id AND m.media_type = 'audio'
        AND m.upload_status = 'ready' AND m.deleted_at IS NULL
      LIMIT 1;
      IF NOT v_has_audio OR v_duration IS NULL OR
         p_audio_timestamp_seconds >= v_duration THEN
        RAISE EXCEPTION 'invalid_timestamp' USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.post_comments (
    post_id, user_id, parent_comment_id, reply_to_comment_id,
    body, audio_timestamp_seconds
  ) VALUES (
    p_post_id, p_user_id, v_parent, p_reply_to_comment_id,
    p_body, p_audio_timestamp_seconds
  ) RETURNING id INTO v_comment;
  RETURN v_comment;
END $$;

CREATE OR REPLACE FUNCTION public.set_post_comment_like(
  p_user_id UUID,
  p_post_id UUID,
  p_comment_id UUID,
  p_like BOOLEAN
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_comment public.post_comments%ROWTYPE;
BEGIN
  IF p_like AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id AND length(btrim(display_name)) > 0
  ) THEN
    RAISE EXCEPTION 'profile_required' USING ERRCODE = '22023';
  END IF;
  -- The post lock ensures access visibility and provides a common lock order.
  PERFORM p.id FROM public.posts p
  JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE p.id = p_post_id
    AND (
      pr.visibility = 'public'
      OR p.user_id = p_user_id
      OR (
        pr.visibility = 'followers'
        AND EXISTS (
          SELECT 1
          FROM public.follows f
          WHERE f.follower_id = p_user_id
            AND f.followee_id = p.user_id
            AND f.status = 'accepted'
        )
      )
    )
  FOR UPDATE OF p;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'post_not_found' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_comment FROM public.post_comments
  WHERE id = p_comment_id AND post_id = p_post_id FOR UPDATE;
  IF NOT FOUND OR v_comment.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'comment_not_found' USING ERRCODE = '22023';
  END IF;
  IF p_like THEN
    INSERT INTO public.post_comment_likes(comment_id, user_id)
    VALUES (p_comment_id, p_user_id) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.post_comment_likes
    WHERE comment_id = p_comment_id AND user_id = p_user_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_post_like(
  p_user_id UUID,
  p_post_id UUID,
  p_like BOOLEAN
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN

  IF p_like AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id AND length(btrim(display_name)) > 0
  ) THEN
    RAISE EXCEPTION 'profile_required' USING ERRCODE = '22023';
  END IF;
  PERFORM p.id FROM public.posts p
  JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE p.id = p_post_id
    AND (
      pr.visibility = 'public'
      OR p.user_id = p_user_id
      OR (
        pr.visibility = 'followers'
        AND EXISTS (
          SELECT 1
          FROM public.follows f
          WHERE f.follower_id = p_user_id
            AND f.followee_id = p.user_id
            AND f.status = 'accepted'
        )
      )
    )
  FOR UPDATE OF p;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'post_not_found' USING ERRCODE = '22023';
  END IF;
  IF p_like THEN
    INSERT INTO public.post_likes(post_id,user_id)
    VALUES (p_post_id,p_user_id) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.post_likes
    WHERE post_id = p_post_id AND user_id = p_user_id;
  END IF;
END $$;

COMMIT;
