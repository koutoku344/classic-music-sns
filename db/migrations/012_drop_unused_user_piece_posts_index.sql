-- STEP9: No current feature filters posts by a user-owned piece ID.
-- Keep posts.user_piece_id and its ownership FK; remove only the unused lookup index.
-- Apply after 011_create_posts_and_post_media.sql.
BEGIN;

DROP INDEX IF EXISTS public.posts_user_piece_created_idx;

COMMIT;
