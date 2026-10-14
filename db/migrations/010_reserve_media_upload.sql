-- STEP8: serialize media upload reservations by owner to enforce storage and rate limits.
-- Apply after 009_create_media_and_practice_audio.sql, before enabling uploads.
-- A reservation counts against the owner's quota until it is completed or marked failed.
BEGIN;

CREATE OR REPLACE FUNCTION public.reserve_media_upload(
  p_user_id UUID,
  p_object_key TEXT,
  p_media_type VARCHAR,
  p_mime_type VARCHAR,
  p_size_bytes BIGINT,
  p_quota_bytes BIGINT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_used BIGINT;
  v_recent INTEGER;
  v_media_id UUID;
BEGIN
  IF p_size_bytes <= 0 OR p_quota_bytes <= 0
     OR p_media_type NOT IN ('audio', 'image')
     OR (p_media_type = 'audio' AND p_size_bytes > 200000000)
     OR (p_media_type = 'image' AND p_size_bytes > 10000000) THEN
    RAISE EXCEPTION 'invalid_media_upload' USING ERRCODE = '22023';
  END IF;

  -- Lock the owner row to serialize concurrent reservations for this account.
  PERFORM 1
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'owner_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(size_bytes), 0)
  INTO v_used
  FROM public.media
  WHERE user_id = p_user_id
    AND upload_status IN ('pending', 'ready');

  IF v_used + p_size_bytes > p_quota_bytes THEN
    RAISE EXCEPTION 'storage_quota_exceeded' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*)
  INTO v_recent
  FROM public.media
  WHERE user_id = p_user_id
    AND created_at > now() - INTERVAL '1 minute';

  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'upload_rate_limited' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.media (
    user_id, object_key, media_type, mime_type, size_bytes, upload_status
  )
  VALUES (
    p_user_id, p_object_key, p_media_type, p_mime_type, p_size_bytes, 'pending'
  )
  RETURNING id INTO v_media_id;

  RETURN v_media_id;
END
$$;

COMMIT;
