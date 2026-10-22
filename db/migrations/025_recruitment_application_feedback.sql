-- STEP12 UI feedback: private application message, optional instrument, recruitment notifications.
-- Safe to apply once after 024. Existing application data is retained.
BEGIN;
ALTER TABLE public.recruitments DROP CONSTRAINT recruitment_instruments_check;
ALTER TABLE public.recruitments ADD CONSTRAINT recruitment_instruments_check CHECK
  (cardinality(instruments) BETWEEN 0 AND 10 AND array_position(instruments,NULL) IS NULL);
ALTER TABLE public.recruitment_applications
 ADD COLUMN message varchar(1000) NOT NULL DEFAULT '',
 ADD COLUMN instrument text;
ALTER TABLE public.recruitment_applications ADD CONSTRAINT recruitment_application_message_check
 CHECK (length(btrim(message))<=1000 AND message=btrim(message));
ALTER TABLE public.recruitment_applications ADD CONSTRAINT recruitment_application_instrument_check
 CHECK (instrument IS NULL OR instrument IN ('Piano','Violin','Cello','Viola','Flute','Clarinet','Oboe','Trumpet','Guitar','その他'));
ALTER TABLE public.notifications ADD COLUMN recruitment_id uuid REFERENCES public.recruitments(id) ON DELETE SET NULL;
CREATE INDEX notifications_recruitment_idx ON public.notifications (recruitment_id) WHERE recruitment_id IS NOT NULL;
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
 'post_like','post_comment','comment_reply','comment_like','follow','follow_request','follow_accepted',
 'recruitment_application','recruitment_accepted','recruitment_rejected'
));
-- Notifications are inserted atomically by DB triggers, not by an untrusted client.
CREATE OR REPLACE FUNCTION public.notify_recruitment_application()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 organizer uuid;
 BEGIN
  SELECT r.user_id INTO organizer FROM public.recruitments r WHERE r.id=NEW.recruitment_id;
  IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND OLD.status='rejected' AND NEW.status='pending') THEN
   INSERT INTO public.notifications(recipient_user_id,actor_user_id,type,event_key,recruitment_id)
   VALUES(organizer,NEW.applicant_id,'recruitment_application',
          'recruitment_application:'||NEW.id||':'||NEW.updated_at,NEW.recruitment_id)
   ON CONFLICT(event_key) DO NOTHING;
  ELSIF TG_OP='UPDATE' AND OLD.status='pending' AND NEW.status IN ('accepted','rejected') THEN
   INSERT INTO public.notifications(recipient_user_id,actor_user_id,type,event_key,recruitment_id)
   VALUES(NEW.applicant_id,organizer,CASE WHEN NEW.status='accepted' THEN 'recruitment_accepted' ELSE 'recruitment_rejected' END,
          'recruitment_decision:'||NEW.id||':'||NEW.updated_at,NEW.recruitment_id)
   ON CONFLICT(event_key) DO NOTHING;
  END IF;
  RETURN NEW;
 END $$;
CREATE TRIGGER recruitment_notification_trigger
AFTER INSERT OR UPDATE OF status ON public.recruitment_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_recruitment_application();
COMMIT;
