import type { Match, SelectionScoreBreakdown } from '../../types';
import { TEAM_MAP } from '../../data/teams';
import { useAppOrNull } from '../../context/AppContext';
import { FlagIcon } from '../FlagIcon';

interface BracketMatchProps {
  match: Match;
  showDate?: boolean;
  isFinal?: boolean;
  is3PO?: boolean;
  onPickWinner?: (matchId: string, winnerId: string) => void;
  readOnly?: boolean;
  scoreBreakdown?: SelectionScoreBreakdown[];
}

function ScoreBadges({ scores }: { scores: SelectionScoreBreakdown[] }) {
  if (scores.length === 0) return null;

  return (
    <span className="slot-score-badges" aria-label="Selection points">
      {scores.map(score => (
        <span
          key={`${score.round_key}-${score.selection_type}`}
          className={`slot-score-badge ${score.awarded ? '' : 'slot-score-badge-missed'}`}
          title={`${score.label}: ${score.awarded ? `+${score.points}` : '0'} points`}
        >
          {score.awarded ? `+${score.points}` : '0'}
        </span>
      ))}
    </span>
  );
}

export function BracketMatch({ match, showDate, isFinal, is3PO, onPickWinner, readOnly, scoreBreakdown = [] }: BracketMatchProps) {
  const app = useAppOrNull();
  const pickWinner = onPickWinner ?? app?.pickMatchWinner;
  const isReadOnly = readOnly ?? app?.isReadOnly ?? false;
  const headerLabel = showDate && match.date
    ? match.date
    : isFinal
      ? 'Final'
      : is3PO
        ? '3rd Place'
        : '';

  const team1 = match.slot1.teamId ? TEAM_MAP[match.slot1.teamId] : null;
  const team2 = match.slot2.teamId ? TEAM_MAP[match.slot2.teamId] : null;

  const handlePick = (teamId: string | null) => {
    if (isReadOnly) return;
    if (!teamId) return;
    if (!match.slot1.teamId || !match.slot2.teamId) return; // both slots need teams
    pickWinner?.(match.id, teamId);
  };

  const isSlot1Winner = match.winnerId && match.winnerId === match.slot1.teamId;
  const isSlot2Winner = match.winnerId && match.winnerId === match.slot2.teamId;
  const canPick = !isReadOnly && !!match.slot1.teamId && !!match.slot2.teamId;
  const getSlotScores = (slot: 'slot1' | 'slot2', teamId: string | null, isWinner: boolean) => {
    if (!teamId) return [];
    return scoreBreakdown.filter(score =>
      score.team_id === teamId
      && (score.slot === slot || (score.slot === 'winner' && isWinner)),
    );
  };
  const slot1Scores = getSlotScores('slot1', match.slot1.teamId, Boolean(isSlot1Winner));
  const slot2Scores = getSlotScores('slot2', match.slot2.teamId, Boolean(isSlot2Winner));

  return (
    <div className={`bracket-match ${isFinal ? 'final-match' : ''} ${is3PO ? 'third-place-match' : ''}`}>
      <div className="match-header">
        <span>{headerLabel}</span>
        <span>{match.id}</span>
      </div>

      <div
        className={`match-slot ${isSlot1Winner ? 'winner' : ''} ${!isSlot1Winner && match.winnerId ? 'loser' : ''} ${canPick && team1 ? 'clickable' : ''}`}
        onClick={() => handlePick(match.slot1.teamId)}
      >
        {team1 ? (
          <>
            <span className="slot-flag"><FlagIcon countryCode={team1.countryCode} teamName={team1.name} size={20} /></span>
            <span className="slot-name">{team1.name}</span>
            <ScoreBadges scores={slot1Scores} />
            {isSlot1Winner && isFinal && <span className="champion-trophy">🏆</span>}
          </>
        ) : (
          <span className="slot-tbd">TBD</span>
        )}
      </div>

      <div
        className={`match-slot ${isSlot2Winner ? 'winner' : ''} ${!isSlot2Winner && match.winnerId ? 'loser' : ''} ${canPick && team2 ? 'clickable' : ''}`}
        onClick={() => handlePick(match.slot2.teamId)}
      >
        {team2 ? (
          <>
            <span className="slot-flag"><FlagIcon countryCode={team2.countryCode} teamName={team2.name} size={20} /></span>
            <span className="slot-name">{team2.name}</span>
            <ScoreBadges scores={slot2Scores} />
            {isSlot2Winner && isFinal && <span className="champion-trophy">🏆</span>}
          </>
        ) : (
          <span className="slot-tbd">TBD</span>
        )}
      </div>
    </div>
  );
}
