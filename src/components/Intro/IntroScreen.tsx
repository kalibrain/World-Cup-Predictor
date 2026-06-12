import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

const lockDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const formatLockDate = (isoDate: string) => {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? '' : lockDateFormatter.format(date);
};

const lockStatusLabel = (locksAt: string, isLocked: boolean) => {
  const formatted = formatLockDate(locksAt);
  if (!formatted) return isLocked ? 'Closed' : 'Open';
  return isLocked ? `Closed on ${formatted}` : `Open until ${formatted}`;
};

const bracketLimitLabel = (userBracketCount: number, maxBracketsPerUser: number) => (
  maxBracketsPerUser > 1 ? ` • ${userBracketCount} / ${maxBracketsPerUser} brackets` : ''
);

const cannotSelectClosedTournament = (tournament: { is_locked: boolean; brackets: unknown[] }) => (
  tournament.is_locked && tournament.brackets.length === 0
);

const tournamentActionLabel = (bracketCount: number) => {
  if (bracketCount === 0) return 'Create Bracket';
  return bracketCount === 1 ? 'View Bracket' : 'View Brackets';
};

export function IntroScreen() {
  const {
    selectedTournament,
    tournaments,
    isLoadingTournaments,
    tournamentError,
    persistError,
    isLocked,
    isSaving,
    selectTournament,
    openBracket,
    clearTournamentSelection,
    startBracket,
  } = useApp();
  const { user, isLoading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [actionTournamentId, setActionTournamentId] = useState<string | null>(null);
  const [leaderboardTournamentId, setLeaderboardTournamentId] = useState<string | null>(null);
  const [actionBracketId, setActionBracketId] = useState<string | null>(null);

  const isAuthenticated = Boolean(user);
  const signedInEmail = user?.email ?? 'Google user';

  const joinedTournaments = useMemo(
    () => tournaments.filter(tournament => (
      tournament.is_member
      && !cannotSelectClosedTournament(tournament)
    )),
    [tournaments],
  );

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    const error = await signInWithGoogle();
    if (error) {
      setAuthError(error);
    }
  };

  const handleSelectTournament = async (tournamentId: string) => {
    setFlowError(null);
    setActionTournamentId(tournamentId);
    const error = await selectTournament(tournamentId);
    setActionTournamentId(null);
    if (error) {
      setFlowError(error);
    }
  };

  const handleOpenLeaderboard = async (tournamentId: string) => {
    setFlowError(null);
    setLeaderboardTournamentId(tournamentId);
    const error = await selectTournament(tournamentId);
    setLeaderboardTournamentId(null);
    if (error) {
      setFlowError(error);
      return;
    }
    navigate('/leaderboard');
  };

  const handleOpenBracket = async (bracketId: string) => {
    setFlowError(null);
    setActionBracketId(bracketId);
    const error = await openBracket(bracketId);
    setActionBracketId(null);
    if (error) {
      setFlowError(error);
    }
  };

  const handleCreateBracket = async () => {
    setFlowError(null);
    const error = await startBracket(name);
    if (error) {
      setFlowError(error);
      return;
    }
    setName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (selectedTournament) {
        void handleCreateBracket();
      }
    }
  };

  const canCreateBracket = Boolean(
    selectedTournament
      && !isLocked
      && selectedTournament.user_bracket_count < selectedTournament.max_brackets_per_user,
  );

  const remainingBracketSlots = selectedTournament
    ? Math.max(0, selectedTournament.max_brackets_per_user - selectedTournament.user_bracket_count)
    : 0;

  return (
    <div className="intro-screen">
      <div className="intro-hero">
        <div className="intro-trophy">🏆</div>
        <h1 className="intro-heading">My Bracket Picks</h1>
        <p className="intro-subheading">FIFA World Cup 2026 Bracket Predictor</p>
        <p className="intro-description">
          Join a tournament, rank all 12 groups, pick your third-place qualifiers, and predict your champion.
        </p>
        <Link to="/faq" className="btn btn-outline btn-sm intro-faq-link">
          FAQ & Rules
        </Link>
      </div>

      <div className="intro-form">
        {!isAuthenticated && (
          <>
            <div className="intro-auth-title">Sign in to continue</div>
            <p className="intro-auth-note">
              Sign in with Google, then pick one of your tournaments before creating your bracket.
            </p>
            <button
              className="btn btn-gold btn-lg"
              onClick={() => void handleGoogleSignIn()}
              disabled={isLoading}
            >
              {isLoading ? 'Checking session...' : 'Continue with Google'}
            </button>
            {authError && <p className="intro-auth-error">{authError}</p>}
          </>
        )}

        {isAuthenticated && !selectedTournament && (
          <>
            <div className="intro-auth-title">Choose Tournament</div>
            <p className="intro-auth-note">
              Signed in as <span className="intro-user-pill">{signedInEmail}</span>
            </p>

            <div className="tournament-list">
              {isLoadingTournaments && <p className="intro-auth-note">Loading tournaments...</p>}
              {!isLoadingTournaments && joinedTournaments.length === 0 && (
                <p className="intro-auth-note">You have not joined any tournaments yet.</p>
              )}
              {joinedTournaments.map(tournament => {
                const canOpenLeaderboard = tournament.is_locked && tournament.brackets.length > 0;
                return (
                  <div key={tournament.tournament_id} className="tournament-card">
                    <div className="tournament-card-main">
                      <div className="tournament-name">{tournament.tournament_name}</div>
                      <div className="tournament-meta">
                        {lockStatusLabel(tournament.locks_at, tournament.is_locked)}
                        {bracketLimitLabel(tournament.user_bracket_count, tournament.max_brackets_per_user)}
                      </div>
                    </div>
                    <div className="tournament-card-actions">
                      {canOpenLeaderboard && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => void handleOpenLeaderboard(tournament.tournament_id)}
                          disabled={leaderboardTournamentId === tournament.tournament_id}
                        >
                          {leaderboardTournamentId === tournament.tournament_id ? 'Opening...' : 'Leaderboard'}
                        </button>
                      )}
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => void handleSelectTournament(tournament.tournament_id)}
                        disabled={actionTournamentId === tournament.tournament_id}
                      >
                        {actionTournamentId === tournament.tournament_id
                          ? 'Opening...'
                          : tournamentActionLabel(tournament.brackets.length)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {isAuthenticated && selectedTournament && (
          <>
            <div className="intro-auth-title">Tournament Selected</div>
            <p className="intro-auth-note">
              <span className="intro-user-pill">{selectedTournament.tournament_name}</span>
            </p>

            {isLocked ? (
              <div className="intro-auth-note">
                This tournament is locked. You can view your existing brackets if any were created before lockout.
              </div>
            ) : selectedTournament.brackets.length > 0 ? (
              <p className="intro-auth-note">
                {selectedTournament.user_bracket_count} / {selectedTournament.max_brackets_per_user} bracket slots used.
              </p>
            ) : null}

            {selectedTournament.brackets.length > 0 && (
              <div className="tournament-list">
                {selectedTournament.brackets.map(bracket => (
                  <div key={bracket.id} className="tournament-card">
                    <div>
                      <div className="tournament-name">{bracket.name}</div>
                      <div className="tournament-meta">
                        Furthest step: {bracket.furthest_step}
                        {' • '}
                        Updated {formatLockDate(bracket.updated_at)}
                      </div>
                    </div>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => void handleOpenBracket(bracket.id)}
                      disabled={actionBracketId === bracket.id}
                    >
                      {actionBracketId === bracket.id ? 'Opening...' : 'Open'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {canCreateBracket ? (
              <div className="new-bracket-form">
                <label className="form-label" htmlFor="bracket-name">Name Your Bracket</label>
                <input
                  id="bracket-name"
                  className="form-input"
                  type="text"
                  placeholder="e.g. Mike's Bracket"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={50}
                  autoFocus
                />
                <button
                  className="btn btn-gold btn-lg"
                  onClick={() => void handleCreateBracket()}
                  disabled={!name.trim()}
                >
                  {selectedTournament.brackets.length > 0 ? `Create New Bracket (${remainingBracketSlots} left)` : 'Start Predicting →'}
                </button>
              </div>
            ) : !isLocked && (
              <div className="intro-auth-note">
                You have reached the bracket limit for this tournament.
              </div>
            )}

            <button
              className="btn btn-outline btn-sm"
              onClick={clearTournamentSelection}
              style={{ marginTop: 24 }}
            >
              Choose Different Tournament
            </button>
          </>
        )}

        {(flowError || tournamentError || persistError) && (
          <p className="intro-auth-error">{flowError ?? tournamentError ?? persistError}</p>
        )}

        {isSaving && <p className="intro-auth-note">Saving your latest picks...</p>}

        <div className="intro-card-footer">
          <p className="intro-attribution">
            MyBracketPicks is brought to you by Wettmeisters Tayfun and Kali.
          </p>
          <div className="intro-legal-links" aria-label="Legal links">
            <Link to="/privacy">Privacy Policy</Link>
            <span aria-hidden="true">•</span>
            <Link to="/terms">Terms Of Service</Link>
          </div>
        </div>
      </div>

    </div>
  );
}
