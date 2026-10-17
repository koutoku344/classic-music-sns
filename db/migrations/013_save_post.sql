-- STEP9: Atomic save for posts and attached, reusable media.
-- Requires 011 and 012. Apply before deploying POST/PATCH /posts.
BEGIN;

CREATE OR REPLACE FUNCTION public.save_post(
  p_user_id UUID,
  p_post_id UUID,
  p_body TEXT,
  p_piece_id UUID,
  p_user_piece_id UUID,
  p_comments_enabled BOOLEAN,
  p_feedback_prefs TEXT[],
  p_media_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_post_id UUID;
  v_count INT;
  v_audio INT;
  v_images INT;
  v_media_id UUID;
  v_order INT := 0;
BEGIN
  IF p_user_id IS NULL
     OR p_body IS NULL OR length(p_body) > 2000 OR p_body <> btrim(p_body)
     OR p_comments_enabled IS NULL
     OR p_feedback_prefs IS NULL OR cardinality(p_feedback_prefs) > 3
     OR array_position(p_feedback_prefs, NULL) IS NOT NULL
     OR p_media_ids IS NULL OR cardinality(p_media_ids) > 6
     OR (p_piece_id IS NOT NULL AND p_user_piece_id IS NOT NULL)
     OR (length(p_body) = 0 AND cardinality(p_media_ids) = 0) THEN
    RAISE EXCEPTION 'invalid_post' USING ERRCODE = '22023';
  END IF;

  IF p_user_piece_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_pieces
    WHERE id = p_user_piece_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'piece_not_found' USING ERRCODE = '22023';
  END IF;

  IF p_piece_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.pieces WHERE id = p_piece_id
  ) THEN
    RAISE EXCEPTION 'piece_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT count(DISTINCT x), count(*)
  INTO v_count, v_audio
  FROM unnest(p_media_ids) x;
  IF v_count <> v_audio OR array_position(p_media_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_media_ids' USING ERRCODE = '22023';
  END IF;

  -- Serialize all post edits by locking the parent row.
  IF p_post_id IS NULL THEN
    INSERT INTO public.posts (
      user_id, piece_id, user_piece_id, body,
      comments_enabled, feedback_prefs
    )
    VALUES (
      p_user_id, p_piece_id, p_user_piece_id, p_body,
      p_comments_enabled, p_feedback_prefs
    )
    RETURNING id INTO v_post_id;
  ELSE
    SELECT id INTO v_post_id
    FROM public.posts
    WHERE id = p_post_id AND user_id = p_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'post_not_found' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Lock the referenced media rows, in stable order, for this transaction.
  PERFORM id FROM public.media
  WHERE id = ANY(p_media_ids)
  ORDER BY id
  FOR UPDATE;

  SELECT
    count(*)::int,
    count(*) FILTER (WHERE media_type = 'audio')::int,
    count(*) FILTER (WHERE media_type = 'image')::int
  INTO v_count, v_audio, v_images
  FROM public.media
  WHERE id = ANY(p_media_ids)
    AND user_id = p_user_id
    AND upload_status = 'ready'
    AND deleted_at IS NULL;

  IF v_count <> cardinality(p_media_ids) OR v_audio > 1 OR v_images > 5 THEN
    RAISE EXCEPTION 'media_not_available' USING ERRCODE = '22023';
  END IF;

  IF p_post_id IS NOT NULL THEN
    UPDATE public.posts
    SET piece_id = p_piece_id,
        user_piece_id = p_user_piece_id,
        body = p_body,
        comments_enabled = p_comments_enabled,
        feedback_prefs = p_feedback_prefs,
        updated_at = now()
    WHERE id = v_post_id;
    DELETE FROM public.post_media WHERE post_id = v_post_id;
  END IF;

  FOREACH v_media_id IN ARRAY p_media_ids LOOP
    v_order := v_order + 1;
    INSERT INTO public.post_media(post_id, media_id, user_id, display_order)
    VALUES (v_post_id, v_media_id, p_user_id, v_order);
  END LOOP;

  RETURN v_post_id;
END
$$;

COMMIT;
