ALTER TABLE profiles
ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'public';

ALTER TABLE profiles
ADD CONSTRAINT profiles_visibility_check
CHECK (visibility IN ('public', 'followers', 'private'));

ALTER TABLE profiles
ALTER COLUMN region SET DEFAULT '東京';
