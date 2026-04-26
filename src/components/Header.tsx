import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export function Header() {
  const {
    state,
    isViewOnly,
    isLocked,
    isReadOnly,
    selectedTournament,
    goToShare,
    resetApp,
    clearTournamentSelection,
  } = useApp();
  const { user, isLoading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const handleShare = () => {
    closeMenu();
    goToShare();
  };
  const handleSignOut = () => {
    closeMenu();
    void signOut();
  };
  const handleSwitchTournament = () => {
    closeMenu();
    clearTournamentSelection();
  };
  const handleCreateOwn = () => {
    closeMenu();
    resetApp();
  };

  const canShare = state.step !== 'intro';
  const showShare = !isReadOnly && canShare && state.step !== 'share';
  const showSwitch = !isViewOnly && Boolean(selectedTournament) && state.step !== 'intro';
  const showSignOut = !isViewOnly && !isLoading && Boolean(user);
  const signedInLabel = user?.email ?? user?.user_metadata?.full_name ?? 'Signed in';

  const hasContext = Boolean(selectedTournament) || Boolean(state.bracketName);

  return (
    <header className="app-header" ref={menuRef}>
      <div className="header-inner">
        <div
          className="header-logo"
          onClick={!isViewOnly ? resetApp : undefined}
          style={{ cursor: isViewOnly ? 'default' : 'pointer' }}
        >
          <div className="header-badge">
            <span className="header-trophy">⚽</span>
          </div>
          <div className="header-title-group">
            <div className="header-subtitle">FIFA WORLD CUP</div>
            <div className="header-title">2026 Bracket Predictor</div>
          </div>
        </div>

        <div className="header-actions header-actions-desktop">
          {selectedTournament && (
            <div className="bracket-name-badge">
              {selectedTournament.tournament_name}
              {isLocked ? ' (Locked)' : ''}
            </div>
          )}
          {state.bracketName && (
            <div className="bracket-name-badge">{state.bracketName}</div>
          )}
          {showShare && (
            <button className="btn btn-gold btn-sm" onClick={handleShare}>
              Share Bracket
            </button>
          )}
          {showSwitch && (
            <button className="btn btn-outline btn-sm" onClick={handleSwitchTournament}>
              Switch Tournament
            </button>
          )}
          {showSignOut && <div className="user-badge">{signedInLabel}</div>}
          {showSignOut && (
            <button className="btn btn-outline btn-sm" onClick={() => void signOut()}>
              Sign Out
            </button>
          )}
          {isViewOnly && (
            <button className="btn btn-outline btn-sm" onClick={resetApp}>
              Create My Own
            </button>
          )}
        </div>

        <button
          type="button"
          className="header-hamburger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen(o => !o)}
        >
          <span className="header-hamburger-icon" aria-hidden="true">
            {menuOpen ? '✕' : '☰'}
          </span>
        </button>
      </div>

      {hasContext && (
        <div className="header-subbanner">
          <div className="header-subbanner-text">
            {selectedTournament && (
              <span className="header-subbanner-pill">
                {selectedTournament.tournament_name}
                {isLocked ? ' (Locked)' : ''}
              </span>
            )}
            {state.bracketName && (
              <span className="header-subbanner-pill header-subbanner-pill-muted">
                {state.bracketName}
              </span>
            )}
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="header-menu" role="menu">
          {showSignOut && (
            <div className="header-menu-email" title={signedInLabel}>
              {signedInLabel}
            </div>
          )}
          {showShare && (
            <button className="btn btn-gold" onClick={handleShare} role="menuitem">
              Share Bracket
            </button>
          )}
          {showSwitch && (
            <button className="btn btn-outline" onClick={handleSwitchTournament} role="menuitem">
              Switch Tournament
            </button>
          )}
          {showSignOut && (
            <button className="btn btn-outline" onClick={handleSignOut} role="menuitem">
              Sign Out
            </button>
          )}
          {isViewOnly && (
            <button className="btn btn-outline" onClick={handleCreateOwn} role="menuitem">
              Create My Own
            </button>
          )}
        </div>
      )}
    </header>
  );
}
