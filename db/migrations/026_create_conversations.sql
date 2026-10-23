-- STEP13: conversations between an approved applicant and recruitment organizer.
-- Participant identities are snapshotted, so deleting a recruitment does not destroy chat history.
BEGIN;
CREATE TABLE public.conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id uuid UNIQUE REFERENCES public.recruitment_applications(id) ON DELETE SET NULL,
 organizer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 applicant_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 recruitment_description varchar(2000) NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 organizer_read_at timestamptz NOT NULL DEFAULT now(),
 applicant_read_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT conversations_distinct_participants CHECK (organizer_id <> applicant_id)
);
CREATE INDEX conversations_organizer_recent_idx ON public.conversations(organizer_id,updated_at DESC,id DESC);
CREATE INDEX conversations_applicant_recent_idx ON public.conversations(applicant_id,updated_at DESC,id DESC);
CREATE TABLE public.direct_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 body varchar(2000) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT direct_messages_nonempty CHECK (length(btrim(body)) BETWEEN 1 AND 2000 AND body=btrim(body))
);
CREATE INDEX direct_messages_conversation_idx ON public.direct_messages(conversation_id,created_at DESC,id DESC);
COMMIT;
