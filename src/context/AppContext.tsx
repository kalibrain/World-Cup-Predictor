/* eslint-disable react-refresh/only-export-components */
import {
  type ReactNode,
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { AppState, AppStep } from '../types';
import { createInitialGroups } from '../data/teams';
import { createInitialMatches, BRACKET_FEED } from '../data/bracket';
import { assignThirdPlaceTeams } from '../utils/thirdPlaceAssignment';
import { useAuth } from './AuthContext';
import {
  createTournamentBracket,
  fetchBracketById,
  getUserTournamentContexts,
  joinPrivateTournamentByName,
  joinPublicTournament,
  saveBracketSnapshot,
  type TournamentContext,
  upsertProfile,
} from '../lib/persistence';

const STEP_ORDER: AppStep[] = ['intro', 'groups', 'third-place', 'bracket'];

function stepIndex(step: AppStep): number {
  return STEP_ORDER.indexOf(step);
}

function buildInitialState(): AppState {
  return {
    step: 'intro',
    furthestStep: 'intro',
    bracketName: '',
    groups: createInitialGroups(),
    selectedThirdPlace: [],
    thirdPlaceAssignment: {},
    matches: createInitialMatches(),
    totalGoals: null,
    topScorer: '',
  };
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function lockedWithoutBracket(tournament: TournamentContext): boolean {
  return tournament.is_locked && tournament.brackets.length === 0;
}

interface AppContextValue {
  state: AppState;
  isLocked: boolean;
  isReadOnly: boolean;
  selectedTournament: TournamentContext | null;
  tournaments: TournamentContext[];
  isLoadingTournaments: boolean;
  isSaving: boolean;
  persistError: string | null;
  tournamentError: string | null;
  refreshTournaments: () => Promise<void>;
  selectTournament: (tournamentId: string) => Promise<string | null>;
  selectPrivateTournament: (tournamentName: string) => Promise<string | null>;
  openBracket: (nextBracketId: string) => Promise<string | null>;
  clearTournamentSelection: () => void;
  setBracketName: (name: string) => void;
  setTotalGoals: (value: number | null) => void;
  setTopScorer: (value: string) => void;
  startBracket: (name: string) => Promise<string | null>;
  updateGroupRankings: (groupId: string, rankings: string[]) => void;
  markGroupComplete: (groupId: string) => void;
  goToThirdPlace: () => void;
  toggleThirdPlace: (groupId: string) => void;
  confirmThirdPlace: () => void;
  goBackToGroups: () => void;
  goToStep: (step: AppStep) => void;
  pickMatchWinner: (matchId: string, winnerId: string) => void;
  resetApp: () => void;
  recomputeBracket: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [state, setState] = useState<AppState>(() => buildInitialState());
  const [selectedTournament, setSelectedTournament] = useState<TournamentContext | null>(null);
  const [tournaments, setTournaments] = useState<TournamentContext[]>([]);
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [tournamentError, setTournamentError] = useState<string | null>(null);
  const [bracketId, setBracketId] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  interface SavedSnapshotKeys {
    groupKeys: Record<string, string>;
    knockoutKey: string;
    metaKey: string;
  }
  const lastSavedRef = useRef<{ bracketId: string; keys: SavedSnapshotKeys } | null>(null);

  const computeSnapshotKeys = useCallback((snapshot: AppState): SavedSnapshotKeys => ({
    groupKeys: Object.fromEntries(
      Object.values(snapshot.groups).map(g => [g.id, JSON.stringify(g.rankings)]),
    ),
    knockoutKey: JSON.stringify({
      selectedThirdPlace: snapshot.selectedThirdPlace,
      thirdPlaceAssignment: snapshot.thirdPlaceAssignment,
      matches: snapshot.matches,
      totalGoals: snapshot.totalGoals,
      topScorer: snapshot.topScorer,
    }),
    metaKey: JSON.stringify({
      bracketName: snapshot.bracketName,
      step: snapshot.step,
      furthestStep: snapshot.furthestStep,
    }),
  }), []);

  const isLocked = Boolean(selectedTournament?.is_locked);
  const isReadOnly = isLocked;

  const refreshTournaments = useCallback(async () => {
    if (!user) return;

    setIsLoadingTournaments(true);
    const { data, error } = await getUserTournamentContexts();
    setIsLoadingTournaments(false);

    if (error) {
      setTournamentError(error);
      return;
    }

    setTournamentError(null);
    setTournaments(data);

    // Functional update keeps `selectedTournament` out of this callback's deps,
    // which would otherwise pair with the auth useEffect to spin a refresh loop.
    setSelectedTournament(prev =>
      prev ? data.find(item => item.tournament_id === prev.tournament_id) ?? null : null,
    );
  }, [user]);

  const openBracket = useCallback(async (nextBracketId: string): Promise<string | null> => {
    if (!user) return 'You need to sign in first.';

    setTournamentError(null);
    setPersistError(null);
    setIsLoadingTournaments(true);

    const { data, error } = await fetchBracketById(nextBracketId, user.id);

    setIsLoadingTournaments(false);

    if (error) {
      setTournamentError(error);
      return error;
    }

    if (!data) {
      const message = 'Bracket not found.';
      setTournamentError(message);
      return message;
    }

    setBracketId(data.id);
    lastSavedRef.current = { bracketId: data.id, keys: computeSnapshotKeys(data.state) };
    setState(data.state);
    return null;
  }, [computeSnapshotKeys, user]);

  const selectTournamentContext = useCallback(async (tournament: TournamentContext): Promise<string | null> => {
    if (lockedWithoutBracket(tournament)) {
      const message = 'This tournament is closed and you do not have a bracket to view.';
      setTournamentError(message);
      return message;
    }

    const onlyExistingBracket = tournament.brackets[0];
    if (tournament.max_brackets_per_user === 1 && tournament.user_bracket_count === 1 && onlyExistingBracket) {
      const error = await openBracket(onlyExistingBracket.id);
      if (error) return error;
      setSelectedTournament(tournament);
      return null;
    }

    setSelectedTournament(tournament);
    setPersistError(null);
    setTournamentError(null);
    setBracketId(null);
    lastSavedRef.current = null;
    setState(buildInitialState());

    return null;
  }, [openBracket]);

  const selectTournament = useCallback(async (tournamentId: string): Promise<string | null> => {
    if (!user) return 'You need to sign in first.';

    const current = tournaments.find(t => t.tournament_id === tournamentId);
    if (!current) return 'Tournament not found.';
    if (lockedWithoutBracket(current)) {
      const message = 'This tournament is closed and you do not have a bracket to view.';
      setTournamentError(message);
      return message;
    }

    if (!current.is_member) {
      if (current.visibility === 'private') {
        const message = 'Join this private tournament by name first.';
        setTournamentError(message);
        return message;
      }
      const joinError = await joinPublicTournament(tournamentId);
      if (joinError) {
        setTournamentError(joinError);
        return joinError;
      }
    }

    const { data, error } = await getUserTournamentContexts();
    if (error) {
      setTournamentError(error);
      return error;
    }

    setTournaments(data);

    const selected = data.find(item => item.tournament_id === tournamentId);
    if (!selected) {
      const message = 'Unable to open that tournament right now.';
      setTournamentError(message);
      return message;
    }

    return selectTournamentContext(selected);
  }, [selectTournamentContext, tournaments, user]);

  const selectPrivateTournament = useCallback(async (tournamentName: string): Promise<string | null> => {
    if (!user) return 'You need to sign in first.';

    const name = tournamentName.trim();
    if (!name) return 'Enter the private tournament name.';

    const joinError = await joinPrivateTournamentByName(name);
    if (joinError) {
      // Surface a generic message to avoid leaking which private tournaments exist,
      // but keep the underlying error visible for debugging.
      console.warn('joinPrivateTournamentByName failed:', joinError);
      const message = 'Tournament not found.';
      setTournamentError(message);
      return message;
    }

    const { data, error } = await getUserTournamentContexts();
    if (error) {
      setTournamentError(error);
      return error;
    }

    setTournaments(data);

    const normalizedInput = normalizeName(name);
    const selected = data.find(item => (
      item.visibility === 'private' && normalizeName(item.tournament_name) === normalizedInput
    ));

    if (!selected) {
      const message = 'Tournament not found.';
      setTournamentError(message);
      return message;
    }

    return selectTournamentContext(selected);
  }, [selectTournamentContext, user]);

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedTournament(null);
      setTournaments([]);
      setBracketId(null);
      lastSavedRef.current = null;
      setState(buildInitialState());
      return;
    }

    void upsertProfile(user);
    void refreshTournaments();
  }, [refreshTournaments, user]);

  const setBracketName = useCallback((name: string) => {
    setState(prev => ({ ...prev, bracketName: name }));
  }, []);

  const setTotalGoals = useCallback((value: number | null) => {
    if (isReadOnly) return;
    setState(prev => ({ ...prev, totalGoals: value }));
  }, [isReadOnly]);

  const setTopScorer = useCallback((value: string) => {
    if (isReadOnly) return;
    setState(prev => ({ ...prev, topScorer: value }));
  }, [isReadOnly]);

  const startBracket = useCallback(async (name: string): Promise<string | null> => {
    if (!user) return 'You need to sign in first.';
    if (!selectedTournament) return 'Select a tournament first.';
    if (selectedTournament.is_locked) return 'This tournament is already locked.';

    const trimmedName = name.trim();
    if (!trimmedName) return 'Bracket name is required.';

    if (selectedTournament.user_bracket_count >= selectedTournament.max_brackets_per_user) {
      return 'Bracket limit reached for this tournament.';
    }

    const { bracketId: nextBracketId, error } = await createTournamentBracket({
      tournamentId: selectedTournament.tournament_id,
      name: trimmedName,
    });

    if (error || !nextBracketId) {
      const message = error ?? 'Unable to create bracket.';
      setPersistError(message);
      return message;
    }

    setPersistError(null);
    setBracketId(nextBracketId);
    lastSavedRef.current = null;

    setState({
      ...buildInitialState(),
      bracketName: trimmedName,
      step: 'groups',
      furthestStep: 'groups',
    });

    void refreshTournaments();
    return null;
  }, [refreshTournaments, selectedTournament, user]);

  const updateGroupRankings = useCallback((groupId: string, rankings: string[]) => {
    if (isReadOnly) return;

    setState(prev => {
      const oldRankings = prev.groups[groupId]?.rankings;
      const rankingsChanged = JSON.stringify(oldRankings) !== JSON.stringify(rankings);
      return {
        ...prev,
        groups: {
          ...prev.groups,
          [groupId]: {
            ...prev.groups[groupId],
            rankings,
            completed: true,
          },
        },
        ...(rankingsChanged ? { selectedThirdPlace: [], thirdPlaceAssignment: {} } : {}),
      };
    });
  }, [isReadOnly]);

  const markGroupComplete = useCallback((groupId: string) => {
    if (isReadOnly) return;

    setState(prev => ({
      ...prev,
      groups: {
        ...prev.groups,
        [groupId]: { ...prev.groups[groupId], completed: true },
      },
    }));
  }, [isReadOnly]);

  const goToThirdPlace = useCallback(() => {
    setState(prev => ({
      ...prev,
      step: 'third-place',
      furthestStep: stepIndex('third-place') > stepIndex(prev.furthestStep) ? 'third-place' : prev.furthestStep,
    }));
  }, []);

  const toggleThirdPlace = useCallback((groupId: string) => {
    if (isReadOnly) return;

    setState(prev => {
      const current = prev.selectedThirdPlace;
      if (current.includes(groupId)) {
        return { ...prev, selectedThirdPlace: current.filter(g => g !== groupId) };
      }
      if (current.length < 8) {
        return { ...prev, selectedThirdPlace: [...current, groupId] };
      }
      return prev;
    });
  }, [isReadOnly]);

  const seedBracketFromThirdPlace = useCallback((prev: AppState): AppState | null => {
    if (prev.selectedThirdPlace.length !== 8) return null;

    const assignment = assignThirdPlaceTeams(prev.selectedThirdPlace);
    if (!assignment) return null;

    const newMatches = { ...prev.matches };
    const preserveWinner = (
      winnerId: string | null,
      slot1TeamId: string | null,
      slot2TeamId: string | null,
    ): string | null => (
      winnerId && (winnerId === slot1TeamId || winnerId === slot2TeamId) ? winnerId : null
    );

    const getTeamByRank = (groupId: string, rank: number): string | null => {
      const group = prev.groups[groupId];
      if (!group || group.rankings.length <= rank) return null;
      return group.rankings[rank];
    };

    newMatches['M1'] = {
      ...newMatches['M1'],
      slot1: { teamId: getTeamByRank('E', 0), source: 'Winner Group E' },
      slot2: { teamId: assignment['M1'] ? getTeamByRank(assignment['M1'], 2) : null, source: `3rd Group ${assignment['M1'] ?? ''}` },
    };
    newMatches['M1'].winnerId = preserveWinner(newMatches['M1'].winnerId, newMatches['M1'].slot1.teamId, newMatches['M1'].slot2.teamId);
    newMatches['M2'] = {
      ...newMatches['M2'],
      slot1: { teamId: getTeamByRank('I', 0), source: 'Winner Group I' },
      slot2: { teamId: assignment['M2'] ? getTeamByRank(assignment['M2'], 2) : null, source: `3rd Group ${assignment['M2'] ?? ''}` },
    };
    newMatches['M2'].winnerId = preserveWinner(newMatches['M2'].winnerId, newMatches['M2'].slot1.teamId, newMatches['M2'].slot2.teamId);
    newMatches['M3'] = {
      ...newMatches['M3'],
      slot1: { teamId: getTeamByRank('A', 1), source: 'Runner-up Group A' },
      slot2: { teamId: getTeamByRank('B', 1), source: 'Runner-up Group B' },
    };
    newMatches['M3'].winnerId = preserveWinner(newMatches['M3'].winnerId, newMatches['M3'].slot1.teamId, newMatches['M3'].slot2.teamId);
    newMatches['M4'] = {
      ...newMatches['M4'],
      slot1: { teamId: getTeamByRank('F', 0), source: 'Winner Group F' },
      slot2: { teamId: getTeamByRank('C', 1), source: 'Runner-up Group C' },
    };
    newMatches['M4'].winnerId = preserveWinner(newMatches['M4'].winnerId, newMatches['M4'].slot1.teamId, newMatches['M4'].slot2.teamId);
    newMatches['M5'] = {
      ...newMatches['M5'],
      slot1: { teamId: getTeamByRank('K', 1), source: 'Runner-up Group K' },
      slot2: { teamId: getTeamByRank('L', 1), source: 'Runner-up Group L' },
    };
    newMatches['M5'].winnerId = preserveWinner(newMatches['M5'].winnerId, newMatches['M5'].slot1.teamId, newMatches['M5'].slot2.teamId);
    newMatches['M6'] = {
      ...newMatches['M6'],
      slot1: { teamId: getTeamByRank('H', 0), source: 'Winner Group H' },
      slot2: { teamId: getTeamByRank('J', 1), source: 'Runner-up Group J' },
    };
    newMatches['M6'].winnerId = preserveWinner(newMatches['M6'].winnerId, newMatches['M6'].slot1.teamId, newMatches['M6'].slot2.teamId);
    newMatches['M7'] = {
      ...newMatches['M7'],
      slot1: { teamId: getTeamByRank('D', 0), source: 'Winner Group D' },
      slot2: { teamId: assignment['M7'] ? getTeamByRank(assignment['M7'], 2) : null, source: `3rd Group ${assignment['M7'] ?? ''}` },
    };
    newMatches['M7'].winnerId = preserveWinner(newMatches['M7'].winnerId, newMatches['M7'].slot1.teamId, newMatches['M7'].slot2.teamId);
    newMatches['M8'] = {
      ...newMatches['M8'],
      slot1: { teamId: getTeamByRank('G', 0), source: 'Winner Group G' },
      slot2: { teamId: assignment['M8'] ? getTeamByRank(assignment['M8'], 2) : null, source: `3rd Group ${assignment['M8'] ?? ''}` },
    };
    newMatches['M8'].winnerId = preserveWinner(newMatches['M8'].winnerId, newMatches['M8'].slot1.teamId, newMatches['M8'].slot2.teamId);
    newMatches['M9'] = {
      ...newMatches['M9'],
      slot1: { teamId: getTeamByRank('C', 0), source: 'Winner Group C' },
      slot2: { teamId: getTeamByRank('F', 1), source: 'Runner-up Group F' },
    };
    newMatches['M9'].winnerId = preserveWinner(newMatches['M9'].winnerId, newMatches['M9'].slot1.teamId, newMatches['M9'].slot2.teamId);
    newMatches['M10'] = {
      ...newMatches['M10'],
      slot1: { teamId: getTeamByRank('E', 1), source: 'Runner-up Group E' },
      slot2: { teamId: getTeamByRank('I', 1), source: 'Runner-up Group I' },
    };
    newMatches['M10'].winnerId = preserveWinner(newMatches['M10'].winnerId, newMatches['M10'].slot1.teamId, newMatches['M10'].slot2.teamId);
    newMatches['M11'] = {
      ...newMatches['M11'],
      slot1: { teamId: getTeamByRank('A', 0), source: 'Winner Group A' },
      slot2: { teamId: assignment['M11'] ? getTeamByRank(assignment['M11'], 2) : null, source: `3rd Group ${assignment['M11'] ?? ''}` },
    };
    newMatches['M11'].winnerId = preserveWinner(newMatches['M11'].winnerId, newMatches['M11'].slot1.teamId, newMatches['M11'].slot2.teamId);
    newMatches['M12'] = {
      ...newMatches['M12'],
      slot1: { teamId: getTeamByRank('L', 0), source: 'Winner Group L' },
      slot2: { teamId: assignment['M12'] ? getTeamByRank(assignment['M12'], 2) : null, source: `3rd Group ${assignment['M12'] ?? ''}` },
    };
    newMatches['M12'].winnerId = preserveWinner(newMatches['M12'].winnerId, newMatches['M12'].slot1.teamId, newMatches['M12'].slot2.teamId);
    newMatches['M13'] = {
      ...newMatches['M13'],
      slot1: { teamId: getTeamByRank('J', 0), source: 'Winner Group J' },
      slot2: { teamId: getTeamByRank('H', 1), source: 'Runner-up Group H' },
    };
    newMatches['M13'].winnerId = preserveWinner(newMatches['M13'].winnerId, newMatches['M13'].slot1.teamId, newMatches['M13'].slot2.teamId);
    newMatches['M14'] = {
      ...newMatches['M14'],
      slot1: { teamId: getTeamByRank('D', 1), source: 'Runner-up Group D' },
      slot2: { teamId: getTeamByRank('G', 1), source: 'Runner-up Group G' },
    };
    newMatches['M14'].winnerId = preserveWinner(newMatches['M14'].winnerId, newMatches['M14'].slot1.teamId, newMatches['M14'].slot2.teamId);
    newMatches['M15'] = {
      ...newMatches['M15'],
      slot1: { teamId: getTeamByRank('B', 0), source: 'Winner Group B' },
      slot2: { teamId: assignment['M15'] ? getTeamByRank(assignment['M15'], 2) : null, source: `3rd Group ${assignment['M15'] ?? ''}` },
    };
    newMatches['M15'].winnerId = preserveWinner(newMatches['M15'].winnerId, newMatches['M15'].slot1.teamId, newMatches['M15'].slot2.teamId);
    newMatches['M16'] = {
      ...newMatches['M16'],
      slot1: { teamId: getTeamByRank('K', 0), source: 'Winner Group K' },
      slot2: { teamId: assignment['M16'] ? getTeamByRank(assignment['M16'], 2) : null, source: `3rd Group ${assignment['M16'] ?? ''}` },
    };
    newMatches['M16'].winnerId = preserveWinner(newMatches['M16'].winnerId, newMatches['M16'].slot1.teamId, newMatches['M16'].slot2.teamId);

    for (const [matchId, [feed1, feed2]] of Object.entries(BRACKET_FEED)) {
      const winner1 = newMatches[feed1]?.winnerId ?? null;
      const winner2 = newMatches[feed2]?.winnerId ?? null;
      newMatches[matchId] = {
        ...newMatches[matchId],
        slot1: { teamId: winner1, source: `Winner ${feed1}` },
        slot2: { teamId: winner2, source: `Winner ${feed2}` },
      };
      newMatches[matchId].winnerId = preserveWinner(newMatches[matchId].winnerId, winner1, winner2);
    }

    const sf1 = newMatches['SF1'];
    const sf2 = newMatches['SF2'];
    const sf1Loser = sf1.winnerId
      ? (sf1.winnerId === sf1.slot1.teamId ? sf1.slot2.teamId : sf1.slot1.teamId)
      : null;
    const sf2Loser = sf2.winnerId
      ? (sf2.winnerId === sf2.slot1.teamId ? sf2.slot2.teamId : sf2.slot1.teamId)
      : null;
    newMatches['3PO'] = {
      ...newMatches['3PO'],
      slot1: { teamId: sf1Loser, source: 'SF1 Loser' },
      slot2: { teamId: sf2Loser, source: 'SF2 Loser' },
    };
    newMatches['3PO'].winnerId = preserveWinner(newMatches['3PO'].winnerId, sf1Loser, sf2Loser);

    return {
      ...prev,
      thirdPlaceAssignment: assignment,
      matches: newMatches,
    };
  }, []);

  const confirmThirdPlace = useCallback(() => {
    if (isReadOnly) return;

    setState(prev => {
      const seeded = seedBracketFromThirdPlace(prev);
      if (!seeded) return prev;
      return {
        ...seeded,
        step: 'bracket',
        furthestStep: stepIndex('bracket') > stepIndex(prev.furthestStep) ? 'bracket' : prev.furthestStep,
      };
    });
  }, [isReadOnly, seedBracketFromThirdPlace]);

  const goBackToGroups = useCallback(() => {
    setState(prev => ({ ...prev, step: 'groups' }));
  }, []);

  const goToStep = useCallback((step: AppStep) => {
    setState(prev => {
      if (stepIndex(step) > stepIndex(prev.furthestStep)) return prev;
      if (step === 'intro') return prev;
      if (step === 'bracket' && prev.step === 'third-place') {
        if (isReadOnly) {
          return { ...prev, step };
        }
        const seeded = seedBracketFromThirdPlace(prev);
        if (!seeded) return prev;
        return {
          ...seeded,
          step: 'bracket',
          furthestStep: stepIndex('bracket') > stepIndex(prev.furthestStep) ? 'bracket' : prev.furthestStep,
        };
      }
      return { ...prev, step };
    });
  }, [isReadOnly, seedBracketFromThirdPlace]);

  const recomputeBracket = useCallback(() => {
    if (isReadOnly) return;

    setState(prev => {
      const newMatches = { ...prev.matches };

      for (const [matchId, [feed1, feed2]] of Object.entries(BRACKET_FEED)) {
        const winner1 = newMatches[feed1]?.winnerId ?? null;
        const winner2 = newMatches[feed2]?.winnerId ?? null;
        newMatches[matchId] = {
          ...newMatches[matchId],
          slot1: { teamId: winner1, source: `Winner ${feed1}` },
          slot2: { teamId: winner2, source: `Winner ${feed2}` },
        };
      }

      const sf1 = newMatches['SF1'];
      const sf2 = newMatches['SF2'];
      const sf1Loser = sf1.winnerId
        ? (sf1.winnerId === sf1.slot1.teamId ? sf1.slot2.teamId : sf1.slot1.teamId)
        : null;
      const sf2Loser = sf2.winnerId
        ? (sf2.winnerId === sf2.slot1.teamId ? sf2.slot2.teamId : sf2.slot1.teamId)
        : null;
      newMatches['3PO'] = {
        ...newMatches['3PO'],
        slot1: { teamId: sf1Loser, source: 'SF1 Loser' },
        slot2: { teamId: sf2Loser, source: 'SF2 Loser' },
      };

      return { ...prev, matches: newMatches };
    });
  }, [isReadOnly]);

  const pickMatchWinner = useCallback((matchId: string, winnerId: string) => {
    if (isReadOnly) return;

    setState(prev => {
      const newMatches = { ...prev.matches };
      newMatches[matchId] = { ...newMatches[matchId], winnerId };

      for (const [upMatchId, [feed1, feed2]] of Object.entries(BRACKET_FEED)) {
        const winner1 = newMatches[feed1]?.winnerId ?? null;
        const winner2 = newMatches[feed2]?.winnerId ?? null;
        newMatches[upMatchId] = {
          ...newMatches[upMatchId],
          slot1: { teamId: winner1, source: `Winner ${feed1}` },
          slot2: { teamId: winner2, source: `Winner ${feed2}` },
        };
      }

      const sf1 = newMatches['SF1'];
      const sf2 = newMatches['SF2'];
      const sf1Loser = sf1.winnerId
        ? (sf1.winnerId === sf1.slot1.teamId ? sf1.slot2.teamId : sf1.slot1.teamId)
        : null;
      const sf2Loser = sf2.winnerId
        ? (sf2.winnerId === sf2.slot1.teamId ? sf2.slot2.teamId : sf2.slot1.teamId)
        : null;
      newMatches['3PO'] = {
        ...newMatches['3PO'],
        slot1: { teamId: sf1Loser, source: 'SF1 Loser' },
        slot2: { teamId: sf2Loser, source: 'SF2 Loser' },
      };

      return { ...prev, matches: newMatches };
    });
  }, [isReadOnly]);

  const resetApp = useCallback(() => {
    setPersistError(null);
    setTournamentError(null);
    setBracketId(null);
    lastSavedRef.current = null;
    setSelectedTournament(null);
    setState(buildInitialState());
  }, []);

  const clearTournamentSelection = useCallback(() => {
    setPersistError(null);
    setTournamentError(null);
    setBracketId(null);
    lastSavedRef.current = null;
    setSelectedTournament(null);
    setState(buildInitialState());
  }, []);

  useEffect(() => {
    if (!user || !selectedTournament || !bracketId) {
      return;
    }

    if (selectedTournament.is_locked) {
      return;
    }

    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }

    saveTimer.current = window.setTimeout(() => {
      void (async () => {
        const currentKeys = computeSnapshotKeys(state);
        const last = lastSavedRef.current;
        const lastKeys = last && last.bracketId === bracketId ? last.keys : null;

        const dirtyGroupIds = Object.keys(currentKeys.groupKeys).filter(
          id => !lastKeys || currentKeys.groupKeys[id] !== lastKeys.groupKeys[id],
        );
        const knockoutChanged = !lastKeys || currentKeys.knockoutKey !== lastKeys.knockoutKey;
        const metaChanged = !lastKeys || currentKeys.metaKey !== lastKeys.metaKey;

        if (dirtyGroupIds.length === 0 && !knockoutChanged && !metaChanged) {
          return;
        }

        setIsSaving(true);
        const error = await saveBracketSnapshot({
          bracketId,
          bracketName: state.bracketName,
          state,
          dirtyGroupIds,
          knockoutChanged,
          metaChanged,
        });
        setIsSaving(false);

        if (error) {
          setPersistError(error);
        } else {
          setPersistError(null);
          lastSavedRef.current = { bracketId, keys: currentKeys };
        }
      })();
    }, 350);

    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [
    bracketId,
    computeSnapshotKeys,
    selectedTournament,
    state,
    user,
  ]);

  const value = useMemo<AppContextValue>(() => ({
    state,
    isLocked,
    isReadOnly,
    selectedTournament,
    tournaments,
    isLoadingTournaments,
    isSaving,
    persistError,
    tournamentError,
    refreshTournaments,
    selectTournament,
    selectPrivateTournament,
    openBracket,
    clearTournamentSelection,
    setBracketName,
    setTotalGoals,
    setTopScorer,
    startBracket,
    updateGroupRankings,
    markGroupComplete,
    goToThirdPlace,
    toggleThirdPlace,
    confirmThirdPlace,
    goBackToGroups,
    goToStep,
    pickMatchWinner,
    resetApp,
    recomputeBracket,
  }), [
    state,
    isLocked,
    isReadOnly,
    selectedTournament,
    tournaments,
    isLoadingTournaments,
    isSaving,
    persistError,
    tournamentError,
    refreshTournaments,
    selectTournament,
    selectPrivateTournament,
    openBracket,
    clearTournamentSelection,
    setBracketName,
    setTotalGoals,
    setTopScorer,
    startBracket,
    updateGroupRankings,
    markGroupComplete,
    goToThirdPlace,
    toggleThirdPlace,
    confirmThirdPlace,
    goBackToGroups,
    goToStep,
    pickMatchWinner,
    resetApp,
    recomputeBracket,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function useAppOrNull() {
  return useContext(AppContext);
}
