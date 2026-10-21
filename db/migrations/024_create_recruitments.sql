-- STEP12: public recruitment board. No audio/media association.
BEGIN;
CREATE TABLE public.recruitments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 piece_id uuid REFERENCES public.pieces(id) ON DELETE RESTRICT,
 instruments text[] NOT NULL,
 regions text[] NOT NULL,
 level varchar(16) NOT NULL,
 purpose varchar(40) NOT NULL,
 description varchar(2000) NOT NULL,
 status varchar(12) NOT NULL DEFAULT 'open',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT recruitment_instruments_check CHECK (cardinality(instruments) BETWEEN 1 AND 10 AND array_position(instruments,NULL) IS NULL),
 CONSTRAINT recruitment_regions_check CHECK (cardinality(regions) BETWEEN 1 AND 10 AND array_position(regions,NULL) IS NULL),
 CONSTRAINT recruitment_level_check CHECK (level IN ('初級','中級','上級','問わない')),
 CONSTRAINT recruitment_purpose_check CHECK (purpose IN ('アンサンブル','発表会','趣味で合わせ','その他')),
 CONSTRAINT recruitment_description_check CHECK (length(btrim(description)) BETWEEN 1 AND 2000 AND description=btrim(description)),
 CONSTRAINT recruitment_status_check CHECK (status IN ('open','closed'))
);
CREATE INDEX recruitments_feed_idx ON public.recruitments (status,created_at DESC,id DESC);
CREATE INDEX recruitments_owner_idx ON public.recruitments (user_id,created_at DESC);
CREATE INDEX recruitments_piece_idx ON public.recruitments (piece_id,created_at DESC) WHERE piece_id IS NOT NULL;
CREATE TABLE public.recruitment_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recruitment_id uuid NOT NULL REFERENCES public.recruitments(id) ON DELETE CASCADE,
 applicant_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 status varchar(12) NOT NULL DEFAULT 'pending',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT recruitment_application_unique UNIQUE (recruitment_id,applicant_id),
 CONSTRAINT recruitment_application_status_check CHECK (status IN ('pending','accepted','rejected'))
);
CREATE INDEX recruitment_applications_owner_idx ON public.recruitment_applications (recruitment_id,status,created_at DESC);
CREATE INDEX recruitment_applications_applicant_idx ON public.recruitment_applications (applicant_id,created_at DESC);
COMMIT;
