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
  fetchBracketForTournament,
  getUserTournamentContexts,
  joinPrivateTournamentByName,
  joinPublicTournament,
  saveBracketSnapshot,
  type TournamentContext,
  upsertBracketShell,
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
  };
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
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
  selectPublicTournament: (tournamentId: string) => Promise<string | null>;
  selectPrivateTournament: (tournamentName: string) => Promise<string | null>;
  clearTournamentSelection: () => void;
  setBracketName: (name: string) => void;
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

  const computeSnapshotKeys = (snapshot: AppState): SavedSnapshotKeys => ({
    groupKeys: Object.fromEntries(
      Object.values(snapshot.groups).map(g => [g.id, JSON.stringify(g.rankings)]),
    ),
    knockoutKey: JSON.stringify({
      selectedThirdPlace: snapshot.selectedThirdPlace,
      thirdPlaceAssignment: snapshot.thirdPlaceAssignment,
      matches: snapshot.matches,
    }),
    metaKey: JSON.stringify({
      bracketName: snapshot.bracketName,
      step: snapshot.step,
      furthestStep: snapshot.furthestStep,
    }),
  });

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

  const loadTournamentBracket = useCallback(async (tournament: TournamentContext): Promise<string | null> => {
    if (!user) return 'You need to sign in first.';

    setTournamentError(null);
    setPersistError(null);
    setIsLoadingTournaments(true);

    const { data, error } = await fetchBracketForTournament(tournament.tournament_id, user.id);

    setIsLoadingTournaments(false);

    if (error) {
      setTournamentError(error);
      return error;
    }

    setSelectedTournament(tournament);

    if (!data) {
      setBracketId(null);
      lastSavedRef.current = null;
      setState(buildInitialState());
      return null;
    }

    setBracketId(data.id);
    lastSavedRef.current = { bracketId: data.id, keys: computeSnapshotKeys(data.state) };
    setState(data.state);
    return null;
  }, [user]);

  const selectPublicTournament = useCallback(async (tournamentId: string): Promise<string | null> => {
    if (!user) return 'You need to sign in first.';

    const current = tournaments.find(t => t.tournament_id === tournamentId);
    if (!current) return 'Tournament not found.';

    if (!current.is_member) {
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

    return loadTournamentBracket(selected);
  }, [loadTournamentBracket, tournaments, user]);

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

    return loadTournamentBracket(selected);
  }, [loadTournamentBracket, user]);

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

  const startBracket = useCallback(async (name: string): Promise<string | null> => {
    if (!user) return 'You need to sign in first.';
    if (!selectedTournament) return 'Select a tournament first.';
    if (selectedTournament.is_locked) return 'This tournament is already locked.';

    const trimmedName = name.trim();
    if (!trimmedName) return 'Bracket name is required.';

    const { bracketId: nextBracketId, error } = await upsertBracketShell({
      bracketId,
      tournamentId: selectedTournament.tournament_id,
      userId: user.id,
      name: trimmedName,
    });

    if (error || !nextBracketId) {
      const message = error ?? 'Unable to create bracket.';
      setPersistError(message);
      return message;
    }

    setPersistError(null);
    setBracketId(nextBracketId);

    setState(prev => ({
      ...prev,
      bracketName: trimmedName,
      step: 'groups',
      furthestStep: stepIndex('groups') > stepIndex(prev.furthestStep) ? 'groups' : prev.furthestStep,
    }));

    void refreshTournaments();
    return null;
  }, [bracketId, refreshTournaments, selectedTournament, user]);

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

    const getTeamByRank = (groupId: string, rank: number): string | null => {
      const group = prev.groups[groupId];
      if (!group || group.rankings.length <= rank) return null;
      return group.rankings[rank];
    };

    newMatches['M1'] = {
      ...newMatches['M1'],
      slot1: { teamId: getTeamByRank('E', 0), source: 'Winner Group E' },
      slot2: { teamId: assignment['M1'] ? getTeamByRank(assignment['M1'], 2) : null, source: `3rd Group ${assignment['M1'] ?? ''}` },
      winnerId: null,
    };
    newMatches['M2'] = {
      ...newMatches['M2'],
      slot1: { teamId: getTeamByRank('I', 0), source: 'Winner Group I' },
      slot2: { teamId: assignment['M2'] ? getTeamByRank(assignment['M2'], 2) : null, source: `3rd Group ${assignment['M2'] ?? ''}` },
      winnerId: null,
    };
    newMatches['M3'] = {
      ...newMatches['M3'],
      slot1: { teamId: getTeamByRank('A', 1), source: 'Runner-up Group A' },
      slot2: { teamId: getTeamByRank('B', 1), source: 'Runner-up Group B' },
      winnerId: null,
    };
    newMatches['M4'] = {
      ...newMatches['M4'],
      slot1: { teamId: getTeamByRank('F', 0), source: 'Winner Group F' },
      slot2: { teamId: getTeamByRank('C', 1), source: 'Runner-up Group C' },
      winnerId: null,
    };
    newMatches['M5'] = {
      ...newMatches['M5'],
      slot1: { teamId: getTeamByRank('K', 1), source: 'Runner-up Group K' },
      slot2: { teamId: getTeamByRank('L', 1), source: 'Runner-up Group L' },
      winnerId: null,
    };
    newMatches['M6'] = {
      ...newMatches['M6'],
      slot1: { teamId: getTeamByRank('H', 0), source: 'Winner Group H' },
      slot2: { teamId: getTeamByRank('J', 1), source: 'Runner-up Group J' },
      winnerId: null,
    };
    newMatches['M7'] = {
      ...newMatches['M7'],
      slot1: { teamId: getTeamByRank('D', 0), source: 'Winner Group D' },
      slot2: { teamId: assignment['M7'] ? getTeamByRank(assignment['M7'], 2) : null, source: `3rd Group ${assignment['M7'] ?? ''}` },
      winnerId: null,
    };
    newMatches['M8'] = {
      ...newMatches['M8'],
      slot1: { teamId: getTeamByRank('G', 0), source: 'Winner Group G' },
      slot2: { teamId: assignment['M8'] ? getTeamByRank(assignment['M8'], 2) : null, source: `3rd Group ${assignment['M8'] ?? ''}` },
      winnerId: null,
    };
    newMatches['M9'] = {
      ...newMatches['M9'],
      slot1: { teamId: getTeamByRank('C', 0), source: 'Winner Group C' },
      slot2: { teamId: getTeamByRank('F', 1), source: 'Runner-up Group F' },
      winnerId: null,
    };
    newMatches['M10'] = {
      ...newMatches['M10'],
      slot1: { teamId: getTeamByRank('E', 1), source: 'Runner-up Group E' },
      slot2: { teamId: getTeamByRank('I', 1), source: 'Runner-up Group I' },
      winnerId: null,
    };
    newMatches['M11'] = {
      ...newMatches['M11'],
      slot1: { teamId: getTeamByRank('A', 0), source: 'Winner Group A' },
      slot2: { teamId: assignment['M11'] ? getTeamByRank(assignment['M11'], 2) : null, source: `3rd Group ${assignment['M11'] ?? ''}` },
      winnerId: null,
    };
    newMatches['M12'] = {
      ...newMatches['M12'],
      slot1: { teamId: getTeamByRank('L', 0), source: 'Winner Group L' },
      slot2: { teamId: assignment['M12'] ? getTeamByRank(assignment['M12'], 2) : null, source: `3rd Group ${assignment['M12'] ?? ''}` },
      winnerId: null,
    };
    newMatches['M13'] = {
      ...newMatches['M13'],
      slot1: { teamId: getTeamByRank('J', 0), source: 'Winner Group J' },
      slot2: { teamId: getTeamByRank('H', 1), source: 'Runner-up Group H' },
      winnerId: null,
    };
    newMatches['M14'] = {
      ...newMatches['M14'],
      slot1: { teamId: getTeamByRank('D', 1), source: 'Runner-up Group D' },
      slot2: { teamId: getTeamByRank('G', 1), source: 'Runner-up Group G' },
      winnerId: null,
    };
    newMatches['M15'] = {
      ...newMatches['M15'],
      slot1: { teamId: getTeamByRank('B', 0), source: 'Winner Group B' },
      slot2: { teamId: assignment['M15'] ? getTeamByRank(assignment['M15'], 2) : null, source: `3rd Group ${assignment['M15'] ?? ''}` },
      winnerId: null,
    };
    newMatches['M16'] = {
      ...newMatches['M16'],
      slot1: { teamId: getTeamByRank('K', 0), source: 'Winner Group K' },
      slot2: { teamId: assignment['M16'] ? getTeamByRank(assignment['M16'], 2) : null, source: `3rd Group ${assignment['M16'] ?? ''}` },
      winnerId: null,
    };

    for (const matchId of Object.keys(BRACKET_FEED)) {
      newMatches[matchId] = {
        ...newMatches[matchId],
        slot1: { teamId: null },
        slot2: { teamId: null },
        winnerId: null,
      };
    }
    newMatches['3PO'] = {
      ...newMatches['3PO'],
      slot1: { teamId: null },
      slot2: { teamId: null },
      winnerId: null,
    };

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
  }, [seedBracketFromThirdPlace]);

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
    selectPublicTournament,
    selectPrivateTournament,
    clearTournamentSelection,
    setBracketName,
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
    selectPublicTournament,
    selectPrivateTournament,
    clearTournamentSelection,
    setBracketName,
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
