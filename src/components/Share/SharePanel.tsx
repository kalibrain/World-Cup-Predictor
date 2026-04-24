import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { buildShareUrl } from '../../utils/urlEncoding';
import { TEAM_MAP } from '../../data/teams';
import { FlagIcon } from '../FlagIcon';

export function SharePanel() {
  const { state, isViewOnly, resetApp, goToStep } = useApp();
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    setShareUrl(buildShareUrl(state));
  }, [state]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const finalMatch = state.matches['FINAL'];
  const champion = finalMatch?.winnerId;
  const championTeam = champion ? TEAM_MAP[champion] : null;

  const runnerUpId = finalMatch?.winnerId
    ? (finalMatch.winnerId === finalMatch.slot1.teamId ? finalMatch.slot2.teamId : finalMatch.slot1.teamId)
    : null;
  const runnerUpTeam = runnerUpId ? TEAM_MAP[runnerUpId] : null;

  const thirdPlaceWinner = state.matches['3PO']?.winnerId;
  const thirdPlaceTeam = thirdPlaceWinner ? TEAM_MAP[thirdPlaceWinner] : null;

  return (
    <div className="share-panel">
      <div className="share-header">
        <div className="share-trophy">🏆</div>
        <h2 className="share-title">{state.bracketName || 'My Bracket'}</h2>
        <p className="share-subtitle">2026 FIFA World Cup Predictions</p>
      </div>

      {(championTeam || runnerUpTeam || thirdPlaceTeam) && (
        <div className="share-picks">
          {championTeam && (
            <div className="share-pick champion-pick">
              <div className="pick-label">🥇 World Champion</div>
              <div className="pick-team">
                <span className="pick-flag"><FlagIcon countryCode={championTeam.countryCode} teamName={championTeam.name} size={28} /></span>
                <span className="pick-name">{championTeam.name}</span>
              </div>
            </div>
          )}
          {runnerUpTeam && (
            <div className="share-pick runner-up-pick">
              <div className="pick-label">🥈 Runner-up</div>
              <div className="pick-team">
                <span className="pick-flag"><FlagIcon countryCode={runnerUpTeam.countryCode} teamName={runnerUpTeam.name} size={28} /></span>
                <span className="pick-name">{runnerUpTeam.name}</span>
              </div>
            </div>
          )}
          {thirdPlaceTeam && (
            <div className="share-pick">
              <div className="pick-label">🥉 3rd Place</div>
              <div className="pick-team">
                <span className="pick-flag"><FlagIcon countryCode={thirdPlaceTeam.countryCode} teamName={thirdPlaceTeam.name} size={28} /></span>
                <span className="pick-name">{thirdPlaceTeam.name}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="share-url-section">
        <div className="share-url-label">Shareable Link</div>
        <div className="share-url-box">
          <input
            className="share-url-input"
            type="text"
            readOnly
            value={shareUrl}
            onClick={e => (e.target as HTMLInputElement).select()}
          />
          <button className={`btn ${copied ? 'btn-success' : 'btn-gold'}`} onClick={handleCopy}>
            {copied ? '✓ Copied!' : 'Copy Link'}
          </button>
        </div>
        <p className="share-url-note">
          Anyone with this link can view your bracket predictions (read-only).
        </p>
      </div>

      {!isViewOnly && (
        <div className="share-actions">
          <button className="btn btn-outline" onClick={() => goToStep('bracket')}>
            ← Back to Bracket
          </button>
          <button className="btn btn-outline" onClick={resetApp}>
            Start New Bracket
          </button>
        </div>
      )}

      {isViewOnly && (
        <div className="view-only-banner">
          <p>You are viewing <strong>{state.bracketName || 'someone\'s'}</strong> bracket in read-only mode.</p>
          <button className="btn btn-gold" onClick={resetApp}>
            Create My Own Bracket
          </button>
        </div>
      )}
    </div>
  );
}
