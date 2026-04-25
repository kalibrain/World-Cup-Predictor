import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export function IntroScreen() {
  const {
    selectedTournament,
    tournaments,
    isLoadingTournaments,
    tournamentError,
    persistError,
    isLocked,
    isSaving,
    selectPublicTournament,
    selectPrivateTournament,
    clearTournamentSelection,
    startBracket,
  } = useApp();
  const { user, isLoading, signInWithGoogle } = useAuth();

  const [name, setName] = useState('');
  const [privateTournamentName, setPrivateTournamentName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [actionTournamentId, setActionTournamentId] = useState<string | null>(null);

  const isAuthenticated = Boolean(user);
  const signedInEmail = user?.email ?? 'Google user';

  const publicTournaments = useMemo(
    () => tournaments.filter(tournament => tournament.visibility === 'public'),
    [tournaments],
  );

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    const error = await signInWithGoogle();
    if (error) {
      setAuthError(error);
    }
  };

  const handleSelectPublicTournament = async (tournamentId: string) => {
    setFlowError(null);
    setActionTournamentId(tournamentId);
    const error = await selectPublicTournament(tournamentId);
    setActionTournamentId(null);
    if (error) {
      setFlowError(error);
    }
  };

  const handleJoinPrivateTournament = async () => {
    setFlowError(null);
    const error = await selectPrivateTournament(privateTournamentName);
    if (error) {
      setFlowError(error);
      return;
    }
    setPrivateTournamentName('');
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
        return;
      }
      if (activeTab === 'private') {
        void handleJoinPrivateTournament();
      }
    }
  };

  return (
    <div className="intro-screen">
      <div className="intro-hero">
        <div className="intro-trophy">🏆</div>
        <h1 className="intro-heading">FIFA World Cup 2026</h1>
        <p className="intro-subheading">Bracket Predictor</p>
        <p className="intro-description">
          Join a tournament, rank all 12 groups, pick your third-place qualifiers, and predict your champion.
        </p>
      </div>

      <div className="intro-form">
        {!isAuthenticated && (
          <>
            <div className="intro-auth-title">Sign in to continue</div>
            <p className="intro-auth-note">
              Sign in with Google, then pick your public or private tournament before creating your bracket.
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

            <div className="tournament-tab-row">
              <button
                className={`btn btn-sm ${activeTab === 'public' ? 'btn-gold' : 'btn-outline'}`}
                onClick={() => setActiveTab('public')}
              >
                Public
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'private' ? 'btn-gold' : 'btn-outline'}`}
                onClick={() => setActiveTab('private')}
              >
                Private
              </button>
            </div>

            {activeTab === 'public' && (
              <div className="tournament-list">
                {isLoadingTournaments && <p className="intro-auth-note">Loading tournaments...</p>}
                {!isLoadingTournaments && publicTournaments.length === 0 && (
                  <p className="intro-auth-note">No public tournaments are available yet.</p>
                )}
                {publicTournaments.map(tournament => (
                  <div key={tournament.tournament_id} className="tournament-card">
                    <div>
                      <div className="tournament-name">{tournament.tournament_name}</div>
                      <div className="tournament-meta">
                        {tournament.is_member ? 'Joined' : 'Public'}
                        {tournament.is_locked ? ' • Locked' : ' • Open'}
                      </div>
                    </div>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => void handleSelectPublicTournament(tournament.tournament_id)}
                      disabled={actionTournamentId === tournament.tournament_id}
                    >
                      {actionTournamentId === tournament.tournament_id ? 'Opening...' : 'Select'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'private' && (
              <>
                <label className="form-label" htmlFor="private-tournament-name">
                  Enter Exact Private Tournament Name
                </label>
                <input
                  id="private-tournament-name"
                  className="form-input"
                  type="text"
                  value={privateTournamentName}
                  placeholder="Exact name shared by your organizer"
                  onChange={e => setPrivateTournamentName(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  className="btn btn-gold btn-lg"
                  onClick={() => void handleJoinPrivateTournament()}
                  disabled={!privateTournamentName.trim()}
                >
                  Join Private Tournament
                </button>
              </>
            )}
          </>
        )}

        {isAuthenticated && selectedTournament && (
          <>
            <div className="intro-auth-title">Tournament Selected</div>
            <p className="intro-auth-note">
              <span className="intro-user-pill">{selectedTournament.tournament_name}</span>
              {' '}
              ({selectedTournament.visibility})
            </p>

            {isLocked ? (
              <div className="intro-auth-note">
                This tournament is locked. You can view your existing bracket if one already exists.
              </div>
            ) : (
              <>
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
                  Start Predicting →
                </button>
              </>
            )}

            <button className="btn btn-outline btn-sm" onClick={clearTournamentSelection}>
              Choose Different Tournament
            </button>
          </>
        )}

        {(flowError || tournamentError || persistError) && (
          <p className="intro-auth-error">{flowError ?? tournamentError ?? persistError}</p>
        )}

        {isSaving && <p className="intro-auth-note">Saving your latest picks...</p>}
      </div>

      <div className="intro-steps">
        <div className="intro-step">
          <div className="intro-step-num">1</div>
          <div className="intro-step-text">Choose tournament</div>
        </div>
        <div className="intro-step">
          <div className="intro-step-num">2</div>
          <div className="intro-step-text">Rank 12 groups</div>
        </div>
        <div className="intro-step">
          <div className="intro-step-num">3</div>
          <div className="intro-step-text">Pick knockout winners</div>
        </div>
        <div className="intro-step">
          <div className="intro-step-num">4</div>
          <div className="intro-step-text">Share your bracket</div>
        </div>
      </div>
    </div>
  );
}
