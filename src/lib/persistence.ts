import type { User } from '@supabase/supabase-js';
import { createInitialGroups } from '../data/teams';
import { createInitialMatches } from '../data/bracket';
import type { AppState, AppStep, Match } from '../types';
import { supabase } from './supabase';

export type TournamentVisibility = 'public' | 'private';
export type MembershipRole = 'admin' | 'participant' | null;

export interface TournamentContext {
  tournament_id: string;
  tournament_name: string;
  tournament_slug: string | null;
  visibility: TournamentVisibility;
  status: 'draft' | 'open' | 'locked' | 'archived';
  starts_at: string | null;
  locks_at: string;
  is_locked: boolean;
  is_member: boolean;
  membership_role: MembershipRole;
  bracket_id: string | null;
  bracket_name: string | null;
  bracket_updated_at: string | null;
}

interface BracketRow {
  id: string;
  name: string;
  current_step: AppStep;
  furthest_step: AppStep;
}

interface GroupRankingRow {
  group_id: string;
  rankings: string[];
}

interface KnockoutRow {
  selected_third_place: string[];
  third_place_assignment: Record<string, string>;
  matches: Record<string, Match>;
  total_goals: number | null;
  top_scorer: string;
}

export interface LoadedBracket {
  id: string;
  state: AppState;
}

function normalizeStep(step: string | null | undefined): AppStep {
  const valid: AppStep[] = ['intro', 'groups', 'third-place', 'bracket'];
  return valid.includes(step as AppStep) ? (step as AppStep) : 'groups';
}

function mergeMatches(savedMatches: unknown): Record<string, Match> {
  const initialMatches = createInitialMatches();
  if (!savedMatches || typeof savedMatches !== 'object') {
    return initialMatches;
  }

  const next = { ...initialMatches };
  const entries = Object.entries(savedMatches as Record<string, Match>);
  for (const [matchId, match] of entries) {
    if (!next[matchId] || !match || typeof match !== 'object') continue;
    next[matchId] = {
      ...next[matchId],
      ...match,
      slot1: { ...next[matchId].slot1, ...match.slot1 },
      slot2: { ...next[matchId].slot2, ...match.slot2 },
    };
  }

  return next;
}

export async function upsertProfile(user: User): Promise<string | null> {
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email ?? null,
    display_name: user.user_metadata?.full_name ?? user.email ?? null,
  });

  return error?.message ?? null;
}

export async function getUserTournamentContexts(): Promise<{ data: TournamentContext[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_user_tournament_contexts');
  return {
    data: (data ?? []) as TournamentContext[],
    error: error?.message ?? null,
  };
}

export async function joinPublicTournament(tournamentId: string): Promise<string | null> {
  const { error } = await supabase.rpc('join_public_tournament', {
    p_tournament_id: tournamentId,
  });

  return error?.message ?? null;
}

export async function joinPrivateTournamentByName(inputName: string): Promise<string | null> {
  const { error } = await supabase.rpc('join_private_tournament_by_name', {
    input_name: inputName,
  });

  return error?.message ?? null;
}

export async function fetchBracketForTournament(
  tournamentId: string,
  userId: string,
): Promise<{ data: LoadedBracket | null; error: string | null }> {
  const { data: bracketRow, error: bracketError } = await supabase
    .from('brackets')
    .select('id, name, current_step, furthest_step')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .maybeSingle();

  if (bracketError) {
    return { data: null, error: bracketError.message };
  }

  if (!bracketRow) {
    return { data: null, error: null };
  }

  const bracket = bracketRow as BracketRow;

  const [{ data: rankingsData, error: rankingsError }, { data: knockoutData, error: knockoutError }] = await Promise.all([
    supabase
      .from('bracket_group_rankings')
      .select('group_id, rankings')
      .eq('bracket_id', bracket.id),
    supabase
      .from('bracket_knockout_picks')
      .select('selected_third_place, third_place_assignment, matches, total_goals, top_scorer')
      .eq('bracket_id', bracket.id)
      .maybeSingle(),
  ]);

  if (rankingsError) {
    return { data: null, error: rankingsError.message };
  }

  if (knockoutError) {
    return { data: null, error: knockoutError.message };
  }

  const groups = createInitialGroups();
  for (const row of (rankingsData ?? []) as GroupRankingRow[]) {
    if (!groups[row.group_id]) continue;
    groups[row.group_id] = {
      ...groups[row.group_id],
      rankings: row.rankings,
      completed: row.rankings.length === 4,
    };
  }

  const knockout = (knockoutData ?? null) as KnockoutRow | null;

  const state: AppState = {
    step: normalizeStep(bracket.current_step),
    furthestStep: normalizeStep(bracket.furthest_step),
    bracketName: bracket.name,
    groups,
    selectedThirdPlace: knockout?.selected_third_place ?? [],
    thirdPlaceAssignment: knockout?.third_place_assignment ?? {},
    matches: mergeMatches(knockout?.matches),
    totalGoals: knockout?.total_goals ?? null,
    topScorer: knockout?.top_scorer ?? '',
  };

  return {
    data: {
      id: bracket.id,
      state,
    },
    error: null,
  };
}

export async function upsertBracketShell(params: {
  bracketId?: string | null;
  tournamentId: string;
  userId: string;
  name: string;
}): Promise<{ bracketId: string | null; error: string | null }> {
  // Omit current_step / furthest_step so the table defaults apply on INSERT
  // and existing values are preserved on UPDATE — autosave is the source of
  // truth for step progression.
  const payload = {
    ...(params.bracketId ? { id: params.bracketId } : {}),
    tournament_id: params.tournamentId,
    user_id: params.userId,
    name: params.name,
  };

  const { data, error } = await supabase
    .from('brackets')
    .upsert(payload, {
      onConflict: 'tournament_id,user_id',
    })
    .select('id')
    .single();

  return {
    bracketId: (data?.id as string | undefined) ?? null,
    error: error?.message ?? null,
  };
}

export async function saveBracketSnapshot(params: {
  bracketId: string;
  bracketName: string;
  state: AppState;
  // When provided, only these slices are written. Omit a field to skip that write.
  dirtyGroupIds?: string[];
  knockoutChanged?: boolean;
  metaChanged?: boolean;
}): Promise<string | null> {
  const writeAll = params.dirtyGroupIds === undefined
    && params.knockoutChanged === undefined
    && params.metaChanged === undefined;

  const groupsToWrite = params.dirtyGroupIds
    ? params.dirtyGroupIds
        .map(id => params.state.groups[id])
        .filter((g): g is NonNullable<typeof g> => Boolean(g))
    : writeAll
      ? Object.values(params.state.groups)
      : [];

  if (groupsToWrite.length > 0) {
    const rankingRows = groupsToWrite.map(group => ({
      bracket_id: params.bracketId,
      group_id: group.id,
      rankings: group.rankings,
    }));

    const { error: rankingsError } = await supabase
      .from('bracket_group_rankings')
      .upsert(rankingRows, { onConflict: 'bracket_id,group_id' });

    if (rankingsError) {
      return rankingsError.message;
    }
  }

  if (params.knockoutChanged || writeAll) {
    const { error: knockoutError } = await supabase
      .from('bracket_knockout_picks')
      .upsert({
        bracket_id: params.bracketId,
        selected_third_place: params.state.selectedThirdPlace,
        third_place_assignment: params.state.thirdPlaceAssignment,
        matches: params.state.matches,
        total_goals: params.state.totalGoals,
        top_scorer: params.state.topScorer,
      }, { onConflict: 'bracket_id' });

    if (knockoutError) {
      return knockoutError.message;
    }
  }

  if (params.metaChanged || writeAll) {
    const { error: bracketUpdateError } = await supabase
      .from('brackets')
      .update({
        name: params.bracketName,
        current_step: params.state.step,
        furthest_step: params.state.furthestStep,
      })
      .eq('id', params.bracketId);

    if (bracketUpdateError) {
      return bracketUpdateError.message;
    }
  }

  return null;
}
