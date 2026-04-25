import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export function Header() {
  const { state, isViewOnly, goToShare, resetApp } = useApp();
  const { user, isLoading, signOut } = useAuth();

  const handleShare = () => {
    goToShare();
  };

  const canShare = state.step !== 'intro';
  const showShare = !isViewOnly && canShare && state.step !== 'share';
  const signedInLabel = user?.email ?? user?.user_metadata.full_name ?? 'Signed in';

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-logo" onClick={!isViewOnly ? resetApp : undefined} style={{ cursor: isViewOnly ? 'default' : 'pointer' }}>
          <div className="header-badge">
            <span className="header-trophy">⚽</span>
          </div>
          <div className="header-title-group">
            <div className="header-subtitle">FIFA WORLD CUP</div>
            <div className="header-title">2026 Bracket Predictor</div>
          </div>
        </div>
        <div className="header-right">
          {!isViewOnly && !isLoading && user && (
            <>
              <div className="user-badge">{signedInLabel}</div>
              <button className="btn btn-outline btn-sm" onClick={() => void signOut()}>
                Sign Out
              </button>
            </>
          )}
          {state.bracketName && (
            <div className="bracket-name-badge">{state.bracketName}</div>
          )}
          {showShare && (
            <button className="btn btn-gold btn-sm" onClick={handleShare}>
              Share Bracket
            </button>
          )}
          {isViewOnly && (
            <button className="btn btn-outline btn-sm" onClick={resetApp}>
              Create My Own
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
