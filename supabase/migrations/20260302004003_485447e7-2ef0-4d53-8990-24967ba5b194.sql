
-- Create polls table
CREATE TABLE public.polls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create poll_votes table
CREATE TABLE public.poll_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_key text NOT NULL,
  voter_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(poll_id, voter_hash)
);

-- RLS on polls: public SELECT
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read polls" ON public.polls FOR SELECT USING (true);

-- RLS on poll_votes: public SELECT and INSERT
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read poll votes" ON public.poll_votes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert poll votes" ON public.poll_votes FOR INSERT WITH CHECK (true);

-- Seed first poll
INSERT INTO public.polls (title, options, active) VALUES (
  'O que você mais quer ver por aqui?',
  '[{"key":"a","label":"Entrevista com personagens do Relic"},{"key":"b","label":"Jornal com um resumo do que aconteceu no servidor"},{"key":"c","label":"Sistema de sugestões e votação da melhor sugestão pra ser levada até a staff"},{"key":"d","label":"Dicas de hunt"}]'::jsonb,
  true
);
