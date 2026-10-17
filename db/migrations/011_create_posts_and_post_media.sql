-- STEP9: posts and the reusable post_media association.
-- Requires migrations 005-010. Review before applying in Neon.
-- This migration creates no post rows and does not change media/R2 objects.
BEGIN;

CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  piece_id UUID REFERENCES public.pieces(id) ON DELETE RESTRICT,
  user_piece_id UUID,
  body VARCHAR(2000) NOT NULL DEFAULT '',
  comments_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  feedback_prefs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT posts_owner_id_unique UNIQUE (user_id, id),
  CONSTRAINT posts_piece_source_check CHECK (
    piece_id IS NULL OR user_piece_id IS NULL
  ),
  CONSTRAINT posts_user_piece_owner_fk
    FOREIGN KEY (user_id, user_piece_id)
    REFERENCES public.user_pieces (user_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT posts_body_trimmed_check CHECK (body = btrim(body)),
  CONSTRAINT posts_feedback_prefs_limit_check CHECK (
    cardinality(feedback_prefs) <= 3
  ),
  CONSTRAINT posts_feedback_prefs_no_null_check CHECK (
    array_position(feedback_prefs, NULL) IS NULL
  )
);

-- Cursor pagination: public feed filtered by visibility in the API query.
CREATE INDEX posts_created_idx
  ON public.posts (created_at DESC, id DESC);

-- User's own posts / another user's visible posts.
CREATE INDEX posts_owner_created_idx
  ON public.posts (user_id, created_at DESC, id DESC);

-- Piece filtering. Only create indexes for filters STEP9 will use.
CREATE INDEX posts_piece_created_idx
  ON public.posts (piece_id, created_at DESC, id DESC)
  WHERE piece_id IS NOT NULL;

CREATE INDEX posts_user_piece_created_idx
  ON public.posts (user_piece_id, created_at DESC, id DESC)
  WHERE user_piece_id IS NOT NULL;

-- One post may refer to several media rows; the same media may be reused
-- across multiple posts. The owner column is deliberately repeated here:
-- both composite foreign keys require the post and media to have that owner.
CREATE TABLE public.post_media (
  post_id UUID NOT NULL,
  media_id UUID NOT NULL,
  user_id UUID NOT NULL,
  display_order SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT post_media_pk PRIMARY KEY (post_id, media_id),
  CONSTRAINT post_media_display_order_check CHECK (
    display_order BETWEEN 1 AND 6
  ),
  CONSTRAINT post_media_post_order_unique UNIQUE (post_id, display_order),
  CONSTRAINT post_media_post_owner_fk
    FOREIGN KEY (user_id, post_id)
    REFERENCES public.posts (user_id, id)
    ON DELETE CASCADE,
  CONSTRAINT post_media_media_owner_fk
    FOREIGN KEY (user_id, media_id)
    REFERENCES public.media (user_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
);

-- The PK (post_id, media_id) already supports lookup by post_id.
-- The UNIQUE constraint (post_id, display_order) supports display order.
-- Reverse lookup is needed to block trash/permanent delete of in-use media.
CREATE INDEX post_media_media_idx
  ON public.post_media (media_id);

COMMIT;
