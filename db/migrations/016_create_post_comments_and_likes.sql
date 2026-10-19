-- STEP10-2: threaded comments, tombstones, and likes for posts/comments.
-- Apply only after STEP9 migrations 011-015; this replaces the UNAPPLIED
-- draft 016 (do not run both versions).
-- CREATE TABLE/INDEX only; existing posts, media and R2 objects are untouched.
BEGIN;

CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  -- Every reply stores its ROOT comment, never another nested reply.
  parent_comment_id UUID,
  -- Actual comment being replied to, for "@username" UI presentation.
  reply_to_comment_id UUID,
  body VARCHAR(1000),
  audio_timestamp_seconds INTEGER,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT post_comments_post_fk
    FOREIGN KEY (post_id)
    REFERENCES public.posts (id)
    ON DELETE CASCADE,

  CONSTRAINT post_comments_user_fk
    FOREIGN KEY (user_id)
    REFERENCES public.users (id)
    ON DELETE CASCADE,

  -- Needed for both same-post self-referencing composite foreign keys.
  CONSTRAINT post_comments_post_id_unique
    UNIQUE (post_id, id),

  CONSTRAINT post_comments_parent_same_post_fk
    FOREIGN KEY (post_id, parent_comment_id)
    REFERENCES public.post_comments (post_id, id)
    ON DELETE CASCADE,

  CONSTRAINT post_comments_reply_target_same_post_fk
    FOREIGN KEY (post_id, reply_to_comment_id)
    REFERENCES public.post_comments (post_id, id)
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT post_comments_reply_shape_check CHECK (
    (parent_comment_id IS NULL AND reply_to_comment_id IS NULL)
    OR (parent_comment_id IS NOT NULL AND reply_to_comment_id IS NOT NULL)
  ),

  CONSTRAINT post_comments_no_self_reference_check CHECK (
    (parent_comment_id IS NULL OR parent_comment_id <> id)
    AND (reply_to_comment_id IS NULL OR reply_to_comment_id <> id)
  ),

  CONSTRAINT post_comments_content_state_check CHECK (
    (
      deleted_at IS NULL
      AND body IS NOT NULL
      AND length(body) BETWEEN 1 AND 1000
      AND body = btrim(body)
      AND (
        audio_timestamp_seconds IS NULL
        OR audio_timestamp_seconds >= 0
      )
    )
    OR (
      deleted_at IS NOT NULL
      AND body IS NULL
      AND audio_timestamp_seconds IS NULL
    )
  ),

  -- Replies are regular text only; timestamp belongs only to top-level comments.
  CONSTRAINT post_comments_reply_timestamp_check CHECK (
    parent_comment_id IS NULL
    OR audio_timestamp_seconds IS NULL
  )
);

-- Root comments: newest first, keyset cursor (created_at,id).
CREATE INDEX post_comments_roots_idx
  ON public.post_comments (post_id, created_at DESC, id DESC)
  WHERE parent_comment_id IS NULL;

-- Replies within one root: oldest first, keyset cursor.
-- Also supports looking up children by parent for "deleted" placeholder logic.
CREATE INDEX post_comments_replies_idx
  ON public.post_comments (post_id, parent_comment_id, created_at, id)
  WHERE parent_comment_id IS NOT NULL;

CREATE INDEX post_comments_user_idx
  ON public.post_comments (user_id);

-- The parent/reply-target FKs ensure both references stay in the same post,
-- but "parent is a root" and "reply_to belongs to that root" are cross-row
-- rules. Validate and serialize in STEP10-3 Backend DB functions.

CREATE TABLE public.post_likes (
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT post_likes_pk
    PRIMARY KEY (post_id, user_id),

  CONSTRAINT post_likes_post_fk
    FOREIGN KEY (post_id)
    REFERENCES public.posts (id)
    ON DELETE CASCADE,

  CONSTRAINT post_likes_user_fk
    FOREIGN KEY (user_id)
    REFERENCES public.users (id)
    ON DELETE CASCADE
);

CREATE INDEX post_likes_user_idx
  ON public.post_likes (user_id);

CREATE TABLE public.post_comment_likes (
  comment_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT post_comment_likes_pk
    PRIMARY KEY (comment_id, user_id),

  CONSTRAINT post_comment_likes_comment_fk
    FOREIGN KEY (comment_id)
    REFERENCES public.post_comments (id)
    ON DELETE CASCADE,

  CONSTRAINT post_comment_likes_user_fk
    FOREIGN KEY (user_id)
    REFERENCES public.users (id)
    ON DELETE CASCADE
);

CREATE INDEX post_comment_likes_user_idx
  ON public.post_comment_likes (user_id);

COMMIT;
