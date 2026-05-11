import { useState } from 'react';
import { useAppOrNull } from '../../context/AppContext';
import { BracketMatch } from './BracketMatch';
import { BracketPrintView } from './BracketPrintView';
import { TEAM_MAP } from '../../data/teams';
import { FlagIcon } from '../FlagIcon';
import type { Match, SelectionScoreBreakdown } from '../../types';

interface RoundColumnProps {
  title: string;
  matchIds: string[];
  matches: Record<string, Match>;
  showDate?: boolean;
  onPickWinner?: (matchId: string, winnerId: string) => void;
  readOnly?: boolean;
  scoreBreakdownByMatch?: Record<string, SelectionScoreBreakdown[]>;
}

function RoundColumn({ title, matchIds, matches, showDate, onPickWinner, readOnly, scoreBreakdownByMatch }: RoundColumnProps) {
  return (
    <div className="bracket-round-col">
      <div className="round-title">{title}</div>
      <div className="round-matches">
        {matchIds.map(id => (
          <div key={id} className="match-wrapper">
            <BracketMatch
              match={matches[id]}
              showDate={showDate}
              onPickWinner={onPickWinner}
              readOnly={readOnly}
              scoreBreakdown={scoreBreakdownByMatch?.[id]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface BracketViewProps {
  matches?: Record<string, Match>;
  totalGoals?: number | null;
  topScorer?: string;
  readOnly?: boolean;
  onPickWinner?: (matchId: string, winnerId: string) => void;
  onTotalGoalsChange?: (value: number | null) => void;
  onTopScorerChange?: (value: string) => void;
  scoringBreakdown?: SelectionScoreBreakdown[];
  showFooter?: boolean;
  onBack?: () => void;
}

export function BracketView(props: BracketViewProps = {}) {
  const [isStartingNewEntry, setIsStartingNewEntry] = useState(false);
  const app = useAppOrNull();
  const matches = props.matches ?? app?.state.matches ?? {};
  const totalGoals = props.totalGoals ?? app?.state.totalGoals ?? null;
  const topScorer = props.topScorer ?? app?.state.topScorer ?? '';
  const readOnly = props.readOnly ?? app?.isReadOnly ?? true;
  const onPickWinner = props.onPickWinner ?? app?.pickMatchWinner ?? (() => {});
  const onTotalGoals = props.onTotalGoalsChange ?? app?.setTotalGoals ?? (() => {});
  const onTopScorer = props.onTopScorerChange ?? app?.setTopScorer ?? (() => {});
  const showFooter = props.showFooter ?? !readOnly;
  const onBack = props.onBack ?? (() => app?.goToStep('third-place'));
  const scoreBreakdownByMatch = props.scoringBreakdown?.reduce<Record<string, SelectionScoreBreakdown[]>>((acc, score) => {
    (acc[score.match_id] ??= []).push(score);
    return acc;
  }, {});
  const isUserBracket = !props.matches && app !== null;
  const stageDescription = isUserBracket && app?.isLocked
    ? 'Tournament has started. No more changes are allowed. Have fun!'
    : 'Click a team in each match to pick the winner. Work left to right, Round of 32 through to the Final.';

  const finalMatch = matches['FINAL'];
  const tpoMatch = matches['3PO'];
  const champion = finalMatch?.winnerId;
  const championTeam = champion ? TEAM_MAP[champion] : null;
  const bracketComplete = isUserBracket
    && Object.values(matches).every(m => Boolean(m.winnerId));
  const canCreateAnotherEntry = Boolean(
    isUserBracket
      && bracketComplete
      && app?.selectedTournament
      && app.selectedTournament.max_brackets_per_user > 1
      && app.selectedTournament.user_bracket_count < app.selectedTournament.max_brackets_per_user
      && !app.isLocked,
  );
  const remainingEntrySlots = app?.selectedTournament
    ? Math.max(0, app.selectedTournament.max_brackets_per_user - app.selectedTournament.user_bracket_count)
    : 0;

  const handleStartNewEntry = async () => {
    if (!app) return;
    setIsStartingNewEntry(true);
    const error = await app.startNewBracketEntry();
    if (error) {
      setIsStartingNewEntry(false);
    }
  };

  return (
    <div className="bracket-screen">
      <div className="stage-header">
        <h2 className="stage-title">Knockout Bracket</h2>
        <p className="stage-desc">{stageDescription}</p>
        {championTeam && (
          <div className="champion-row">
            <div className="champion-banner">
              🏆 Champion: <FlagIcon countryCode={championTeam.countryCode} teamName={championTeam.name} size={24} /> {championTeam.name}
            </div>
            {isUserBracket && (
              <button
                type="button"
                className="btn btn-gold pdf-download-btn"
                onClick={() => window.print()}
                disabled={!bracketComplete}
                title={bracketComplete ? 'Download your bracket as a PDF' : 'Pick every match to enable PDF download'}
              >
                ⬇ Download PDF
              </button>
            )}
          </div>
        )}
        {canCreateAnotherEntry && (
          <div className="new-entry-row">
            <button
              type="button"
              className="btn btn-outline new-entry-btn"
              onClick={() => void handleStartNewEntry()}
              disabled={isStartingNewEntry}
            >
              {isStartingNewEntry ? 'Preparing...' : `Create New Bracket (${remainingEntrySlots} left)`}
            </button>
          </div>
        )}
      </div>

      <div className="bracket-scroll-container">
        <div className="bracket-mirror">
          <RoundColumn title="Round of 32" matchIds={['M1','M2','M3','M4','M5','M6','M7','M8']} matches={matches} showDate onPickWinner={onPickWinner} readOnly={readOnly} scoreBreakdownByMatch={scoreBreakdownByMatch} />
          <RoundColumn title="Round of 16" matchIds={['R16_1','R16_2','R16_3','R16_4']} matches={matches} onPickWinner={onPickWinner} readOnly={readOnly} scoreBreakdownByMatch={scoreBreakdownByMatch} />
          <RoundColumn title="Quarterfinals" matchIds={['QF1','QF2']} matches={matches} onPickWinner={onPickWinner} readOnly={readOnly} scoreBreakdownByMatch={scoreBreakdownByMatch} />
          <RoundColumn title="Semifinal" matchIds={['SF1']} matches={matches} onPickWinner={onPickWinner} readOnly={readOnly} scoreBreakdownByMatch={scoreBreakdownByMatch} />

          <div className="bracket-round-col bracket-center-col">
            <div className="round-title">Final &amp; 3rd Place</div>
            <div className="round-matches final-col-matches">
              <div className="match-wrapper">
                <BracketMatch match={finalMatch} isFinal onPickWinner={onPickWinner} readOnly={readOnly} scoreBreakdown={scoreBreakdownByMatch?.FINAL} />
              </div>
              <div className="match-wrapper">
                <BracketMatch match={tpoMatch} is3PO onPickWinner={onPickWinner} readOnly={readOnly} scoreBreakdown={scoreBreakdownByMatch?.['3PO']} />
              </div>
            </div>
          </div>

          <RoundColumn title="Semifinal" matchIds={['SF2']} matches={matches} onPickWinner={onPickWinner} readOnly={readOnly} scoreBreakdownByMatch={scoreBreakdownByMatch} />
          <RoundColumn title="Quarterfinals" matchIds={['QF3','QF4']} matches={matches} onPickWinner={onPickWinner} readOnly={readOnly} scoreBreakdownByMatch={scoreBreakdownByMatch} />
          <RoundColumn title="Round of 16" matchIds={['R16_5','R16_6','R16_7','R16_8']} matches={matches} onPickWinner={onPickWinner} readOnly={readOnly} scoreBreakdownByMatch={scoreBreakdownByMatch} />
          <RoundColumn title="Round of 32" matchIds={['M9','M10','M11','M12','M13','M14','M15','M16']} matches={matches} showDate onPickWinner={onPickWinner} readOnly={readOnly} scoreBreakdownByMatch={scoreBreakdownByMatch} />
        </div>
      </div>

      <div className="bracket-tiebreakers">
        <div className="tiebreaker-field">
          <label className="form-label" htmlFor="total-goals">Total Goals</label>
          <input
            id="total-goals"
            className="form-input"
            type="number"
            min={0}
            inputMode="numeric"
            value={totalGoals ?? ''}
            onChange={e => {
              const v = e.target.value;
              onTotalGoals(v === '' ? null : Math.max(0, Number(v)));
            }}
            disabled={readOnly}
            placeholder="e.g. 168"
          />
        </div>
        <div className="tiebreaker-field">
          <label className="form-label" htmlFor="top-scorer">Top Scorer</label>
          <input
            id="top-scorer"
            className="form-input"
            type="text"
            maxLength={60}
            value={topScorer}
            onChange={e => onTopScorer(e.target.value)}
            disabled={readOnly}
            placeholder="e.g. Kylian Mbappé"
          />
        </div>
      </div>

      {showFooter && (
        <div className="stage-footer">
          <button className="btn btn-outline" onClick={onBack}>
            ← Back to 3rd Place
          </button>
        </div>
      )}

      {isUserBracket && <BracketPrintView />}
    </div>
  );
}
