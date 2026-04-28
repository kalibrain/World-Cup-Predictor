import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export function Header() {
  const {
    state,
    isLocked,
    selectedTournament,
    resetApp,
    clearTournamentSelection,
  } = useApp();
  const { user, isLoading, isGlobalAdmin, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const onAdminRoute = location.pathname.startsWith('/admin');
  const onLeaderboardRoute = location.pathname.startsWith('/leaderboard');
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

  const handleSignOut = () => {
    closeMenu();
    void signOut();
  };
  const handleSwitchTournament = () => {
    closeMenu();
    clearTournamentSelection();
  };
  const handleToggleTheme = () => {
    closeMenu();
    toggleTheme();
  };
  const themeToggleLabel =
    theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  const themeToggleIcon = theme === 'dark' ? '☀️' : '🌙';

  const showSwitch = Boolean(selectedTournament) && state.step !== 'intro';
  const showLeaderboard = Boolean(selectedTournament);
  const showSignOut = !isLoading && Boolean(user);
  const signedInLabel = user?.email ?? user?.user_metadata?.full_name ?? 'Signed in';

  const hasContext = Boolean(selectedTournament) || Boolean(state.bracketName);

  return (
    <header className="app-header" ref={menuRef}>
      <div className="header-inner">
        <div
          className="header-logo"
          onClick={resetApp}
          style={{ cursor: 'pointer' }}
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
          {showSwitch && (
            <button className="btn btn-outline btn-sm" onClick={handleSwitchTournament}>
              Switch Tournament
            </button>
          )}
          {showLeaderboard && !onLeaderboardRoute && (
            <Link to="/leaderboard" className="btn btn-outline btn-sm">
              Leaderboard
            </Link>
          )}
          {isGlobalAdmin && (
            <Link
              to={onAdminRoute ? '/' : '/admin'}
              className="btn btn-outline btn-sm"
            >
              {onAdminRoute ? 'Predictor' : 'Admin'}
            </Link>
          )}
          {showSignOut && <div className="user-badge">{signedInLabel}</div>}
          <button
            type="button"
            className="theme-toggle"
            aria-label={themeToggleLabel}
            title={themeToggleLabel}
            onClick={toggleTheme}
          >
            <span aria-hidden="true">{themeToggleIcon}</span>
          </button>
          {showSignOut && (
            <button className="btn btn-outline btn-sm" onClick={() => void signOut()}>
              Sign Out
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
          {showSwitch && (
            <button className="btn btn-outline" onClick={handleSwitchTournament} role="menuitem">
              Switch Tournament
            </button>
          )}
          {showLeaderboard && !onLeaderboardRoute && (
            <Link
              to="/leaderboard"
              className="btn btn-outline"
              role="menuitem"
              onClick={closeMenu}
            >
              Leaderboard
            </Link>
          )}
          {isGlobalAdmin && (
            <Link
              to={onAdminRoute ? '/' : '/admin'}
              className="btn btn-outline"
              role="menuitem"
              onClick={closeMenu}
            >
              {onAdminRoute ? 'Predictor' : 'Admin'}
            </Link>
          )}
          <button
            className="btn btn-outline"
            onClick={handleToggleTheme}
            role="menuitem"
          >
            <span aria-hidden="true" style={{ marginRight: 6 }}>
              {themeToggleIcon}
            </span>
            {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
          </button>
          {showSignOut && (
            <button className="btn btn-outline" onClick={handleSignOut} role="menuitem">
              Sign Out
            </button>
          )}
        </div>
      )}
    </header>
  );
}
