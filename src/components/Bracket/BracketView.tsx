import { useApp } from '../../context/AppContext';
import { BracketMatch } from './BracketMatch';
import { TEAM_MAP } from '../../data/teams';
import { FlagIcon } from '../FlagIcon';

interface RoundColumnProps {
  title: string;
  matchIds: string[];
  showDate?: boolean;
}

function RoundColumn({ title, matchIds, showDate }: RoundColumnProps) {
  const { state } = useApp();
  return (
    <div className="bracket-round-col">
      <div className="round-title">{title}</div>
      <div className="round-matches">
        {matchIds.map(id => (
          <div key={id} className="match-wrapper">
            <BracketMatch match={state.matches[id]} showDate={showDate} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BracketView() {
  const { state, isViewOnly, goToShare, goToStep } = useApp();

  const finalMatch = state.matches['FINAL'];
  const tpoMatch = state.matches['3PO'];
  const champion = finalMatch?.winnerId;
  const championTeam = champion ? TEAM_MAP[champion] : null;

  const bracketComplete = !!champion && !!tpoMatch?.winnerId;

  return (
    <div className="bracket-screen">
      <div className="stage-header">
        <h2 className="stage-title">Knockout Bracket</h2>
        <p className="stage-desc">
          Click a team in each match to pick the winner. Work left to right, Round of 32 through to the Final.
        </p>
        {championTeam && (
          <div className="champion-banner">
            🏆 Champion: <FlagIcon countryCode={championTeam.countryCode} teamName={championTeam.name} size={24} /> {championTeam.name}
          </div>
        )}
      </div>

      <div className="bracket-scroll-container">
        <div className="bracket-mirror">
          {/* Left half: flows right → center */}
          <RoundColumn title="Round of 32" matchIds={['M1','M2','M3','M4','M5','M6','M7','M8']} showDate />
          <RoundColumn title="Round of 16" matchIds={['R16_1','R16_2','R16_3','R16_4']} />
          <RoundColumn title="Quarterfinals" matchIds={['QF1','QF2']} />
          <RoundColumn title="Semifinal" matchIds={['SF1']} />

          {/* Center: Final + 3PO */}
          <div className="bracket-round-col bracket-center-col">
            <div className="round-title">Final &amp; 3rd Place</div>
            <div className="round-matches final-col-matches">
              <div className="match-wrapper">
                <BracketMatch match={finalMatch} isFinal />
              </div>
              <div className="match-wrapper">
                <BracketMatch match={tpoMatch} is3PO />
              </div>
            </div>
          </div>

          {/* Right half: mirrors left, flows ← center */}
          <RoundColumn title="Semifinal" matchIds={['SF2']} />
          <RoundColumn title="Quarterfinals" matchIds={['QF3','QF4']} />
          <RoundColumn title="Round of 16" matchIds={['R16_5','R16_6','R16_7','R16_8']} />
          <RoundColumn title="Round of 32" matchIds={['M9','M10','M11','M12','M13','M14','M15','M16']} showDate />
        </div>
      </div>

      {!isViewOnly && (
        <div className="stage-footer">
          <button className="btn btn-outline" onClick={() => goToStep('third-place')}>
            ← Back to 3rd Place
          </button>
          {bracketComplete ? (
            <button className="btn btn-gold btn-lg" onClick={goToShare}>
              🏆 View &amp; Share Your Bracket →
            </button>
          ) : (
            <button className="btn btn-outline" onClick={goToShare}>
              Share Partial Bracket
            </button>
          )}
        </div>
      )}
    </div>
  );
}
