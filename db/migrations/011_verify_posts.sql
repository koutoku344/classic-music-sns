-- STEP9-2: run section A before applying 011 and section B after.
-- SELECT-only verification, no data modifications.

-- Section A: preflight (before migration).
SELECT
  to_regclass('public.users') AS users_table,
  to_regclass('public.pieces') AS pieces_table,
  to_regclass('public.user_pieces') AS user_pieces_table,
  to_regclass('public.media') AS media_table,
  to_regclass('public.posts') AS posts_table,
  to_regclass('public.post_media') AS post_media_table;

-- Section B: expected tables after applying 011.
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('posts', 'post_media')
ORDER BY table_name, ordinal_position;

-- Section C: confirm FKs, UNIQUE and CHECK constraints.
SELECT
  conrelid::regclass AS table_name,
  conname AS constraint_name,
  contype AS type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN ('public.posts'::regclass, 'public.post_media'::regclass)
ORDER BY table_name, constraint_name;

-- Section D: ensure non-redundant indices.
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('posts', 'post_media')
ORDER BY tablename, indexname;
