BEGIN;
CREATE TABLE public.composers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT composers_name_nonempty CHECK (length(btrim(name)) > 0),
  CONSTRAINT composers_name_unique UNIQUE(name)
);
CREATE TABLE public.pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  composer_id UUID NOT NULL REFERENCES public.composers(id) ON DELETE RESTRICT,
  title VARCHAR(240) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pieces_title_nonempty CHECK (length(btrim(title)) > 0),
  CONSTRAINT pieces_composer_title_unique UNIQUE(composer_id,title)
);
-- (composer_id,title) のUNIQUE制約がB-treeインデックスを自動作成するため
-- 同一列・同一順序のCREATE INDEXは追加しない。
CREATE TABLE public.user_repertoire (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  piece_id UUID REFERENCES public.pieces(id) ON DELETE RESTRICT,
  custom_composer VARCHAR(120),
  custom_title VARCHAR(240),
  status VARCHAR(20) NOT NULL DEFAULT 'practicing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_repertoire_status_check
    CHECK(status IN ('practicing','repertoire','performed')),
  CONSTRAINT user_repertoire_source_check CHECK(
    (piece_id IS NOT NULL AND custom_composer IS NULL AND custom_title IS NULL)
    OR
    (piece_id IS NULL AND custom_composer IS NOT NULL AND custom_title IS NOT NULL
      AND length(btrim(custom_composer))>0 AND length(btrim(custom_title))>0)
  )
);
CREATE UNIQUE INDEX user_repertoire_master_unique
  ON public.user_repertoire(user_id,piece_id) WHERE piece_id IS NOT NULL;
CREATE UNIQUE INDEX user_repertoire_custom_unique
  ON public.user_repertoire(user_id,lower(btrim(custom_composer)),lower(btrim(custom_title)))
  WHERE piece_id IS NULL;
CREATE INDEX user_repertoire_user_created_idx
  ON public.user_repertoire(user_id,created_at DESC,id DESC);
COMMIT;
