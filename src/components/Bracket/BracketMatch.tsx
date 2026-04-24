import type { Match } from '../../types';
import { TEAM_MAP } from '../../data/teams';
import { useApp } from '../../context/AppContext';
import { FlagIcon } from '../FlagIcon';

interface BracketMatchProps {
  match: Match;
  showDate?: boolean;
  isFinal?: boolean;
  is3PO?: boolean;
}

export function BracketMatch({ match, showDate, isFinal, is3PO }: BracketMatchProps) {
  const { pickMatchWinner, isViewOnly } = useApp();

  const team1 = match.slot1.teamId ? TEAM_MAP[match.slot1.teamId] : null;
  const team2 = match.slot2.teamId ? TEAM_MAP[match.slot2.teamId] : null;

  const handlePick = (teamId: string | null) => {
    if (isViewOnly) return;
    if (!teamId) return;
    if (!match.slot1.teamId || !match.slot2.teamId) return; // both slots need teams
    pickMatchWinner(match.id, teamId);
  };

  const isSlot1Winner = match.winnerId && match.winnerId === match.slot1.teamId;
  const isSlot2Winner = match.winnerId && match.winnerId === match.slot2.teamId;
  const canPick = !isViewOnly && !!match.slot1.teamId && !!match.slot2.teamId;

  return (
    <div className={`bracket-match ${isFinal ? 'final-match' : ''} ${is3PO ? 'third-place-match' : ''}`}>
      {showDate && match.date && (
        <div className="match-date">{match.date}</div>
      )}
      {isFinal && (
        <div className="final-label">🏆 FINAL</div>
      )}
      {is3PO && (
        <div className="tpo-label">3rd Place</div>
      )}
      <div className="match-id-label">{match.id}</div>

      <div
        className={`match-slot ${isSlot1Winner ? 'winner' : ''} ${!isSlot1Winner && match.winnerId ? 'loser' : ''} ${canPick && team1 ? 'clickable' : ''}`}
        onClick={() => handlePick(match.slot1.teamId)}
      >
        {team1 ? (
          <>
            <span className="slot-flag"><FlagIcon countryCode={team1.countryCode} teamName={team1.name} size={20} /></span>
            <span className="slot-name">{team1.name}</span>
            {isSlot1Winner && isFinal && <span className="champion-trophy">🏆</span>}
          </>
        ) : (
          <span className="slot-tbd">TBD</span>
        )}
      </div>

      <div className="match-vs">vs</div>

      <div
        className={`match-slot ${isSlot2Winner ? 'winner' : ''} ${!isSlot2Winner && match.winnerId ? 'loser' : ''} ${canPick && team2 ? 'clickable' : ''}`}
        onClick={() => handlePick(match.slot2.teamId)}
      >
        {team2 ? (
          <>
            <span className="slot-flag"><FlagIcon countryCode={team2.countryCode} teamName={team2.name} size={20} /></span>
            <span className="slot-name">{team2.name}</span>
            {isSlot2Winner && isFinal && <span className="champion-trophy">🏆</span>}
          </>
        ) : (
          <span className="slot-tbd">TBD</span>
        )}
      </div>
    </div>
  );
}
