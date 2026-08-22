ALTER TABLE public.words
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'word'
  CHECK (type IN ('word','phrase','connector','idiom','tense_pattern'));

CREATE INDEX IF NOT EXISTS idx_words_user_type ON public.words(user_id, type);
