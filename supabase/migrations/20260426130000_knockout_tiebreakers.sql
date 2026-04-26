alter table public.bracket_knockout_picks
  add column if not exists total_goals integer,
  add column if not exists top_scorer  text not null default '';
