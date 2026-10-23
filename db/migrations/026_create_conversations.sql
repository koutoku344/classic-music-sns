-- STEP13 unified direct messages; run only after completing the local checks.
BEGIN;
CREATE TABLE public.conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_a_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 user_b_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 user_a_read_at timestamptz NOT NULL DEFAULT now(),
 user_b_read_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT conversation_no_self CHECK (user_a_id <> user_b_id),
 CONSTRAINT conversation_canonical_pair CHECK (user_a_id < user_b_id),
 CONSTRAINT conversation_unique_pair UNIQUE(user_a_id,user_b_id)
);
CREATE INDEX conversations_user_a_idx ON public.conversations(user_a_id,updated_at DESC,id DESC);
CREATE INDEX conversations_user_b_idx ON public.conversations(user_b_id,updated_at DESC,id DESC);
CREATE TABLE public.direct_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 body varchar(2000) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT direct_message_body CHECK (length(btrim(body)) BETWEEN 1 AND 2000 AND body=btrim(body))
);
CREATE INDEX direct_messages_conversation_idx ON public.direct_messages(conversation_id,created_at DESC,id DESC);
ALTER TABLE public.notifications ADD COLUMN conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
 'post_like','post_comment','comment_reply','comment_like',
 'follow','follow_request','follow_accepted',
 'recruitment_application','recruitment_accepted','recruitment_rejected','direct_message'
));
CREATE INDEX notifications_conversation_idx ON public.notifications(conversation_id) WHERE conversation_id IS NOT NULL;
-- Trigger guarantees notification and message insertion succeed or fail atomically.
CREATE FUNCTION public.notify_direct_message() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE recipient uuid;
BEGIN
 SELECT CASE WHEN c.user_a_id=NEW.sender_id THEN c.user_b_id ELSE c.user_a_id END
 INTO recipient FROM public.conversations c WHERE c.id=NEW.conversation_id;
 INSERT INTO public.notifications(recipient_user_id,actor_user_id,type,event_key,conversation_id)
 VALUES(recipient,NEW.sender_id,'direct_message','direct_message:'||NEW.id,NEW.conversation_id)
 ON CONFLICT(event_key) DO NOTHING;
 UPDATE public.conversations SET updated_at=clock_timestamp() WHERE id=NEW.conversation_id;
 RETURN NEW;
END $$;
CREATE TRIGGER direct_message_notify
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_direct_message();
COMMIT;
