ALTER TABLE public.words
  ADD COLUMN IF NOT EXISTS one_word_en text,
  ADD COLUMN IF NOT EXISTS one_word_ur text,
  ADD COLUMN IF NOT EXISTS synonym text,
  ADD COLUMN IF NOT EXISTS antonym text;