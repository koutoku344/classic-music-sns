-- STEP10-2: Comments and likes for STEP9 posts.
-- Apply AFTER migrations 011-015. Existing posts/media/R2 are untouched.
-- Requires public.posts(id), public.users(id), and gen_random_uuid().
-- REVIEW and run once in Neon SQL Editor after approving the design.
BEGIN;

CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  body VARCHAR(1000) NOT NULL,
  audio_timestamp_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT post_comments_post_fk
    FOREIGN KEY (post_id)
    REFERENCES public.posts(id)
    ON DELETE CASCADE,

  CONSTRAINT post_comments_user_fk
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE,

  CONSTRAINT post_comments_body_check
    CHECK (
      length(body) BETWEEN 1 AND 1000
      AND body = btrim(body)
    ),

  CONSTRAINT post_comments_timestamp_check
    CHECK (
      audio_timestamp_seconds IS NULL
      OR audio_timestamp_seconds >= 0
    )
);

-- Supports cursor pagination for the comments of one post.
-- (post_id, created_at DESC, id DESC) also serves post_id lookups.
CREATE INDEX post_comments_post_created_idx
  ON public.post_comments (post_id, created_at DESC, id DESC);

-- Required for efficient cascade handling when a user is removed.
CREATE INDEX post_comments_user_idx
  ON public.post_comments (user_id);


CREATE TABLE public.post_likes (
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT post_likes_pk
    PRIMARY KEY (post_id, user_id),

  CONSTRAINT post_likes_post_fk
    FOREIGN KEY (post_id)
    REFERENCES public.posts(id)
    ON DELETE CASCADE,

  CONSTRAINT post_likes_user_fk
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE
);

-- The PK covers likes/count by post_id; only user-side lookup needs an index.
CREATE INDEX post_likes_user_idx
  ON public.post_likes (user_id);

COMMIT;
