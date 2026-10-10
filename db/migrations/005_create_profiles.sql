CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(60) NOT NULL DEFAULT '',
  bio VARCHAR(500) NOT NULL DEFAULT '',
  instruments TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  region VARCHAR(80) NOT NULL DEFAULT '東京',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_instruments_limit CHECK (cardinality(instruments) <= 10)
);
