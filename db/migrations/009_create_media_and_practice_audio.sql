-- STEP8: private R2 media metadata and an optional single audio attachment per practice.
-- Execute only after reviewing the preflight checks and arranging compatible API deployment.
-- This migration performs no R2 operations and does not create public bucket access.
BEGIN;

CREATE TABLE public.media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  media_type VARCHAR(10) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,
  duration_seconds INTEGER,
  upload_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  deleted_at TIMESTAMPTZ,
  purge_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT media_owner_id_unique UNIQUE (user_id, id),
  CONSTRAINT media_object_key_unique UNIQUE (object_key),
  CONSTRAINT media_object_key_nonempty CHECK (length(btrim(object_key)) > 0),
  CONSTRAINT media_type_check CHECK (media_type IN ('audio', 'image')),
  CONSTRAINT media_mime_type_nonempty CHECK (length(btrim(mime_type)) > 0),
  CONSTRAINT media_size_positive CHECK (size_bytes > 0),
  CONSTRAINT media_duration_valid CHECK (
    duration_seconds IS NULL OR duration_seconds > 0
  ),
  CONSTRAINT media_upload_status_check CHECK (
    upload_status IN ('pending', 'ready', 'failed')
  ),
  CONSTRAINT media_image_no_duration_check CHECK (
    media_type = 'audio' OR duration_seconds IS NULL
  ),
  CONSTRAINT media_delete_dates_check CHECK (
    (deleted_at IS NULL AND purge_at IS NULL)
    OR
    (deleted_at IS NOT NULL AND purge_at IS NOT NULL AND purge_at >= deleted_at)
  )
);

-- List a user's active and recently deleted media without scanning other owners.
CREATE INDEX media_owner_active_created_idx
  ON public.media (user_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX media_owner_deleted_idx
  ON public.media (user_id, deleted_at DESC, id DESC)
  WHERE deleted_at IS NOT NULL;

-- Recovery jobs: pending upload expiration and 30-day purge processing.
CREATE INDEX media_pending_created_idx
  ON public.media (created_at)
  WHERE upload_status = 'pending';

CREATE INDEX media_purge_due_idx
  ON public.media (purge_at)
  WHERE purge_at IS NOT NULL;

-- A practice record can reference at most one media row.
-- The composite FK enforces that the referenced media belongs to the same user.
-- The API additionally verifies type='audio', upload_status='ready', and not deleted.
ALTER TABLE public.practice_records
  ADD COLUMN audio_media_id UUID;

ALTER TABLE public.practice_records
  ADD CONSTRAINT practice_records_audio_media_owner_fk
  FOREIGN KEY (user_id, audio_media_id)
  REFERENCES public.media (user_id, id)
  ON DELETE NO ACTION
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX practice_records_audio_media_idx
  ON public.practice_records (audio_media_id)
  WHERE audio_media_id IS NOT NULL;

COMMIT;
