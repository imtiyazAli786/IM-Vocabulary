-- Create grammar_attempts table to track grammar drill history and performance metrics
CREATE TABLE public.grammar_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drill_type TEXT NOT NULL CHECK (drill_type IN ('tense_id', 'tense_transform', 'fill_blank', 'spot_error')),
  prompt TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  feedback JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_grammar_attempts_user_date ON public.grammar_attempts (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.grammar_attempts ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
CREATE POLICY "Users view own grammar attempts" ON public.grammar_attempts 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own grammar attempts" ON public.grammar_attempts 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
