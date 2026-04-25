import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export function IntroScreen() {
  const { startBracket } = useApp();
  const { user, isLoading, signInWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const isAuthenticated = Boolean(user);
  const signedInEmail = user?.email ?? 'Google user';

  const handleStart = () => {
    if (isAuthenticated && name.trim()) {
      startBracket(name.trim());
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    const error = await signInWithGoogle();
    if (error) {
      setAuthError(error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
  };

  return (
    <div className="intro-screen">
      <div className="intro-hero">
        <div className="intro-trophy">🏆</div>
        <h1 className="intro-heading">FIFA World Cup 2026</h1>
        <p className="intro-subheading">Bracket Predictor</p>
        <p className="intro-description">
          Rank all 12 groups, pick your third-place qualifiers, and predict your champion.
          Share your bracket with the world!
        </p>
      </div>
      <div className="intro-form">
        {!isAuthenticated && (
          <>
            <div className="intro-auth-title">Sign in to create your bracket</div>
            <p className="intro-auth-note">
              Your bracket will be tied to your account so you can return and update it later.
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

        {isAuthenticated && (
          <>
            <div className="intro-auth-title">You are signed in</div>
            <p className="intro-auth-note">
              Signed in as <span className="intro-user-pill">{signedInEmail}</span>
            </p>
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
              onClick={handleStart}
              disabled={!name.trim()}
            >
              Start Predicting →
            </button>
          </>
        )}
      </div>
      <div className="intro-steps">
        <div className="intro-step">
          <div className="intro-step-num">1</div>
          <div className="intro-step-text">Rank 12 groups</div>
        </div>
        <div className="intro-step">
          <div className="intro-step-num">2</div>
          <div className="intro-step-text">Pick 8 third-place teams</div>
        </div>
        <div className="intro-step">
          <div className="intro-step-num">3</div>
          <div className="intro-step-text">Fill the knockout bracket</div>
        </div>
        <div className="intro-step">
          <div className="intro-step-num">4</div>
          <div className="intro-step-text">Share your predictions</div>
        </div>
      </div>
    </div>
  );
}
