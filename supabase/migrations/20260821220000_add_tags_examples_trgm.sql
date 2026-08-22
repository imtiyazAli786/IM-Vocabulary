-- PostgreSQL extension for fast fuzzy and trigram search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add tags, collocations, and rich contextual examples JSONB array
ALTER TABLE public.words
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS collocations TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS examples JSONB NOT NULL DEFAULT '[]';

-- GIN Index on tags for instant tag filtering at 5k+ words
CREATE INDEX IF NOT EXISTS idx_words_user_tags ON public.words USING GIN (tags);

-- Trigram GIN indexes for fast search across English headwords, English definitions, and Urdu translations
CREATE INDEX IF NOT EXISTS idx_words_trgm_word ON public.words USING gin (word gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_words_trgm_def ON public.words USING gin (definition_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_words_trgm_ur ON public.words USING gin (translation_ur gin_trgm_ops);
