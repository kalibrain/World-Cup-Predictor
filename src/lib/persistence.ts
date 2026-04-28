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

export type TournamentVisibilityWritable = TournamentVisibility;
export type TournamentStatus = 'draft' | 'open' | 'locked' | 'archived';

export interface TournamentOverviewRow {
  tournament_id: string;
  tournament_name: string;
  visibility: TournamentVisibility;
  status: TournamentStatus;
  starts_at: string | null;
  locks_at: string;
  is_locked: boolean;
  edition_id: string;
  edition_name: string;
  member_count: number;
  bracket_count: number;
  created_at: string;
}

export interface TournamentEdition {
  id: string;
  name: string;
  created_at: string;
}

export interface EditionOverviewRow {
  edition_id: string;
  edition_name: string;
  tournament_count: number;
  results_groups_entered: number;
  results_matches_entered: number;
  tiebreakers_entered: boolean;
  published_at: string | null;
  created_at: string;
}

export interface TournamentMemberRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: 'admin' | 'participant';
  joined_at: string;
  bracket_id: string | null;
  bracket_name: string | null;
  bracket_updated_at: string | null;
  bracket_furthest_step: AppStep | null;
}

export interface TournamentResults {
  group_results: Record<string, string[]>;
  match_results: Record<string, string | null>;
  tiebreakers: { total_goals: number | null; top_scorer: string; updated_at: string; updated_by: string | null } | null;
}

export interface StandingsEditorPayload {
  draft_group_results: Record<string, string[]>;
  draft_match_results: Record<string, string | null>;
  published_group_results: Record<string, string[]>;
  published_match_results: Record<string, string | null>;
  published_at: string | null;
  draft_updated_at: string | null;
}

export interface PublishedStandings {
  group_results: Record<string, string[]>;
  match_results: Record<string, string | null>;
  published_at: string | null;
}

export interface LeaderboardRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  bracket_id: string | null;
  bracket_name: string | null;
  group_points: number;
  knockout_points: number;
  total_points: number;
  rank_position: number;
  published_at: string | null;
}

export interface TournamentRow {
  id: string;
  name: string;
  visibility: TournamentVisibility;
  status: TournamentStatus;
  starts_at: string | null;
  locks_at: string;
}

export interface AdminBracketRow {
  bracket_id: string;
  tournament_id: string;
  user_id: string;
  bracket_name: string;
  current_step: AppStep;
  furthest_step: AppStep;
  rankings: Record<string, string[]>;
  knockout: {
    selected_third_place?: string[];
    third_place_assignment?: Record<string, string>;
    matches?: Record<string, Match>;
    total_goals?: number | null;
    top_scorer?: string;
  };
}

export async function adminListTournamentsOverview(): Promise<{ data: TournamentOverviewRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_list_tournaments_overview');
  return {
    data: (data ?? []) as TournamentOverviewRow[],
    error: error?.message ?? null,
  };
}

export async function adminListTournamentMembers(tournamentId: string): Promise<{ data: TournamentMemberRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_list_tournament_members', {
    p_tournament_id: tournamentId,
  });
  return {
    data: (data ?? []) as TournamentMemberRow[],
    error: error?.message ?? null,
  };
}

export async function adminRevokeMembership(tournamentId: string, userId: string): Promise<string | null> {
  const { error } = await supabase.rpc('admin_revoke_membership', {
    p_tournament_id: tournamentId,
    p_user_id: userId,
  });
  return error?.message ?? null;
}

export async function adminDeleteBracket(bracketId: string): Promise<string | null> {
  const { error } = await supabase.rpc('admin_delete_bracket', {
    p_bracket_id: bracketId,
  });
  return error?.message ?? null;
}

export async function adminUpsertGroupResult(
  editionId: string,
  groupId: string,
  rankings: string[],
): Promise<string | null> {
  const { error } = await supabase.rpc('admin_upsert_group_result', {
    p_edition_id: editionId,
    p_group_id: groupId,
    p_rankings: rankings,
  });
  return error?.message ?? null;
}

export async function adminUpsertMatchResult(
  editionId: string,
  matchId: string,
  winnerId: string | null,
): Promise<string | null> {
  const { error } = await supabase.rpc('admin_upsert_match_result', {
    p_edition_id: editionId,
    p_match_id: matchId,
    p_winner_id: winnerId,
  });
  return error?.message ?? null;
}

export async function adminUpsertTiebreakers(
  editionId: string,
  totalGoals: number | null,
  topScorer: string,
): Promise<string | null> {
  const { error } = await supabase.rpc('admin_upsert_tiebreakers', {
    p_edition_id: editionId,
    p_total_goals: totalGoals,
    p_top_scorer: topScorer,
  });
  return error?.message ?? null;
}

export async function adminGetEditionResults(editionId: string): Promise<{ data: TournamentResults | null; error: string | null }> {
  const { data, error } = await supabase
    .rpc('admin_get_edition_results', { p_edition_id: editionId })
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: { group_results: {}, match_results: {}, tiebreakers: null }, error: null };

  const row = data as { group_results: Record<string, string[]>; match_results: Record<string, string | null>; tiebreakers: TournamentResults['tiebreakers'] };
  return {
    data: {
      group_results: row.group_results ?? {},
      match_results: row.match_results ?? {},
      tiebreakers: row.tiebreakers ?? null,
    },
    error: null,
  };
}

export async function adminUpsertTournament(params: {
  id: string | null;
  name: string;
  visibility: TournamentVisibility;
  status: TournamentStatus;
  starts_at: string | null;
  locks_at: string;
  edition_id?: string | null;
}): Promise<{ data: TournamentRow | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_upsert_tournament', {
    p_id: params.id,
    p_name: params.name,
    p_visibility: params.visibility,
    p_status: params.status,
    p_starts_at: params.starts_at,
    p_locks_at: params.locks_at,
    p_edition_id: params.edition_id ?? null,
  });
  return {
    data: (data as TournamentRow | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function adminListEditionsOverview(): Promise<{ data: EditionOverviewRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_list_editions_overview');
  return {
    data: (data ?? []) as EditionOverviewRow[],
    error: error?.message ?? null,
  };
}

export async function adminCreateEdition(name: string): Promise<{ data: TournamentEdition | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_create_edition', { p_name: name });
  return {
    data: (data as TournamentEdition | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function adminArchiveTournament(tournamentId: string): Promise<string | null> {
  const { error } = await supabase.rpc('admin_archive_tournament', {
    p_tournament_id: tournamentId,
  });
  return error?.message ?? null;
}

export async function adminGetStandingsEditor(editionId: string): Promise<{ data: StandingsEditorPayload | null; error: string | null }> {
  const { data, error } = await supabase
    .rpc('admin_get_standings_editor', { p_edition_id: editionId })
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) {
    return {
      data: {
        draft_group_results: {},
        draft_match_results: {},
        published_group_results: {},
        published_match_results: {},
        published_at: null,
        draft_updated_at: null,
      },
      error: null,
    };
  }

  const row = data as StandingsEditorPayload;
  return {
    data: {
      draft_group_results: row.draft_group_results ?? {},
      draft_match_results: row.draft_match_results ?? {},
      published_group_results: row.published_group_results ?? {},
      published_match_results: row.published_match_results ?? {},
      published_at: row.published_at ?? null,
      draft_updated_at: row.draft_updated_at ?? null,
    },
    error: null,
  };
}

export async function adminPublishStandingsUpdate(editionId: string): Promise<{ publishedAt: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_publish_standings_update', {
    p_edition_id: editionId,
  });
  return {
    publishedAt: (data as string | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function getTournamentPublishedStandings(tournamentId: string): Promise<{ data: PublishedStandings | null; error: string | null }> {
  const { data, error } = await supabase
    .rpc('get_tournament_published_standings', { p_tournament_id: tournamentId })
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) {
    return { data: { group_results: {}, match_results: {}, published_at: null }, error: null };
  }

  const row = data as PublishedStandings;
  return {
    data: {
      group_results: row.group_results ?? {},
      match_results: row.match_results ?? {},
      published_at: row.published_at ?? null,
    },
    error: null,
  };
}

export async function getTournamentLeaderboard(tournamentId: string): Promise<{ data: LeaderboardRow[]; publishedAt: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('get_tournament_leaderboard', {
    p_tournament_id: tournamentId,
  });

  if (error) return { data: [], publishedAt: null, error: error.message };

  const rows = (data ?? []) as LeaderboardRow[];
  return {
    data: rows,
    publishedAt: rows[0]?.published_at ?? null,
    error: null,
  };
}

export async function adminGetBracket(bracketId: string): Promise<{ data: AdminBracketRow | null; error: string | null }> {
  const { data, error } = await supabase
    .rpc('admin_get_bracket', { p_bracket_id: bracketId })
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };

  return { data: data as AdminBracketRow, error: null };
}
