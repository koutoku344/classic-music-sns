-- STEP7: user-owned pieces + one piece per practice record.
-- Execute only after checking there are no legacy custom repertoire rows.
-- This migration intentionally does NOT migrate legacy custom piece data.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_repertoire
    WHERE piece_id IS NULL
  ) THEN
    RAISE EXCEPTION 'STEP7 aborted: legacy custom repertoire rows exist. Stop and review before migrating.';
  END IF;
END
$$;

CREATE TABLE public.user_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  composer VARCHAR(120) NOT NULL,
  title VARCHAR(240) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_pieces_composer_nonempty CHECK (length(btrim(composer)) > 0),
  CONSTRAINT user_pieces_title_nonempty CHECK (length(btrim(title)) > 0),
  CONSTRAINT user_pieces_user_id_id_unique UNIQUE (user_id, id)
);

-- Prevent duplicates after trimming the ends and ignoring case.
-- Internal spacing / different abbreviations are intentionally distinct.
CREATE UNIQUE INDEX user_pieces_owner_name_unique
  ON public.user_pieces (
    user_id,
    lower(btrim(composer)),
    lower(btrim(title))
  );
CREATE INDEX user_pieces_owner_created_idx
  ON public.user_pieces(user_id, created_at DESC, id DESC);

-- Existing rows must be catalog pieces (checked above).
ALTER TABLE public.user_repertoire
  DROP CONSTRAINT user_repertoire_source_check;

ALTER TABLE public.user_repertoire
  ADD COLUMN user_piece_id UUID;

-- The composite FK prevents referencing another user's custom piece.
ALTER TABLE public.user_repertoire
  ADD CONSTRAINT user_repertoire_user_piece_owner_fk
  FOREIGN KEY (user_id, user_piece_id)
  REFERENCES public.user_pieces(user_id, id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.user_repertoire
  ADD CONSTRAINT user_repertoire_piece_source_check
  CHECK (
    (piece_id IS NOT NULL AND user_piece_id IS NULL)
    OR
    (piece_id IS NULL AND user_piece_id IS NOT NULL)
  );

DROP INDEX public.user_repertoire_custom_unique;
ALTER TABLE public.user_repertoire
  DROP COLUMN custom_composer,
  DROP COLUMN custom_title;

CREATE UNIQUE INDEX user_repertoire_user_piece_unique
  ON public.user_repertoire(user_id, user_piece_id)
  WHERE user_piece_id IS NOT NULL;

-- Each practice record describes exactly one piece. Multiple records
-- for the same user/date/piece are intentionally allowed.
CREATE TABLE public.practice_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  piece_id UUID REFERENCES public.pieces(id) ON DELETE RESTRICT,
  user_piece_id UUID,
  practice_date DATE NOT NULL,
  duration_minutes INTEGER NOT NULL,
  comment VARCHAR(2000) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT practice_records_piece_source_check
    CHECK (
      (piece_id IS NOT NULL AND user_piece_id IS NULL)
      OR
      (piece_id IS NULL AND user_piece_id IS NOT NULL)
    ),
  CONSTRAINT practice_records_duration_check
    CHECK (duration_minutes BETWEEN 1 AND 1440),
  CONSTRAINT practice_records_user_piece_owner_fk
    FOREIGN KEY (user_id, user_piece_id)
    REFERENCES public.user_pieces(user_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
);

-- Supports chronological listing within one authenticated user.
CREATE INDEX practice_records_owner_date_idx
  ON public.practice_records(
    user_id, practice_date DESC, created_at DESC, id DESC
  );

COMMIT;
