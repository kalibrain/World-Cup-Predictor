import { useApp } from '../../context/AppContext';
import { GROUP_LETTERS, TEAM_MAP } from '../../data/teams';
import { FlagIcon } from '../FlagIcon';
import type { Match } from '../../types';

const lockDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : lockDateFormatter.format(d);
}

interface PrintMatchProps {
  match: Match | undefined;
  showDate?: boolean;
  emphasis?: 'final' | '3po';
}

function PrintMatch({ match, showDate, emphasis }: PrintMatchProps) {
  if (!match) return null;
  const team1 = match.slot1.teamId ? TEAM_MAP[match.slot1.teamId] : null;
  const team2 = match.slot2.teamId ? TEAM_MAP[match.slot2.teamId] : null;
  const isSlot1Winner = match.winnerId && match.winnerId === match.slot1.teamId;
  const isSlot2Winner = match.winnerId && match.winnerId === match.slot2.teamId;

  return (
    <div className={`print-match ${emphasis === 'final' ? 'print-match-final' : ''} ${emphasis === '3po' ? 'print-match-3po' : ''}`}>
      {emphasis === 'final' && <div className="print-match-tag print-match-tag-final">FINAL</div>}
      {emphasis === '3po' && <div className="print-match-tag print-match-tag-3po">3rd Place</div>}
      {showDate && match.date && <div className="print-match-date">{match.date}</div>}
      <div className="print-match-id">{match.id}</div>
      <div className={`print-slot ${isSlot1Winner ? 'print-slot-winner' : ''} ${!isSlot1Winner && match.winnerId ? 'print-slot-loser' : ''}`}>
        {team1 ? (
          <>
            <FlagIcon countryCode={team1.countryCode} teamName={team1.name} size={16} loading="eager" />
            <span className="print-slot-name">{team1.name}</span>
          </>
        ) : (
          <span className="print-slot-tbd">TBD</span>
        )}
      </div>
      <div className={`print-slot ${isSlot2Winner ? 'print-slot-winner' : ''} ${!isSlot2Winner && match.winnerId ? 'print-slot-loser' : ''}`}>
        {team2 ? (
          <>
            <FlagIcon countryCode={team2.countryCode} teamName={team2.name} size={16} loading="eager" />
            <span className="print-slot-name">{team2.name}</span>
          </>
        ) : (
          <span className="print-slot-tbd">TBD</span>
        )}
      </div>
    </div>
  );
}

interface PrintColumnProps {
  title: string;
  matchIds: string[];
  matches: Record<string, Match>;
  showDate?: boolean;
}

function PrintColumn({ title, matchIds, matches, showDate }: PrintColumnProps) {
  return (
    <div className="print-round-col">
      <div className="print-round-title">{title}</div>
      <div className="print-round-matches">
        {matchIds.map(id => (
          <PrintMatch key={id} match={matches[id]} showDate={showDate} />
        ))}
      </div>
    </div>
  );
}

const R32_IDS = ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12','M13','M14','M15','M16'];
const R16_IDS = ['R16_1','R16_2','R16_3','R16_4','R16_5','R16_6','R16_7','R16_8'];
const QF_IDS = ['QF1','QF2','QF3','QF4'];
const SF_IDS = ['SF1','SF2'];

export function BracketPrintView() {
  const { state, selectedTournament } = useApp();
  const finalMatch = state.matches['FINAL'];
  const tpoMatch = state.matches['3PO'];
  const champion = finalMatch?.winnerId ? TEAM_MAP[finalMatch.winnerId] : null;
  const lockLabel = selectedTournament ? formatDate(selectedTournament.locks_at) : '';
  const startLabel = selectedTournament ? formatDate(selectedTournament.starts_at) : '';

  return (
    <div className="print-view" aria-hidden="true">
      <header className="print-header">
        <div className="print-header-top">
          <div>
            <div className="print-eyebrow">FIFA World Cup 2026 Bracket Predictor</div>
            <h1 className="print-title">{selectedTournament?.tournament_name ?? 'Tournament'}</h1>
            {state.bracketName && <div className="print-bracket-name">Bracket: {state.bracketName}</div>}
          </div>
          {champion && (
            <div className="print-champion">
              <div className="print-champion-label">CHAMPION</div>
              <div className="print-champion-name">
                <FlagIcon countryCode={champion.countryCode} teamName={champion.name} size={20} loading="eager" />
                <span>{champion.name}</span>
              </div>
            </div>
          )}
        </div>
        <div className="print-meta">
          {selectedTournament?.visibility && (
            <span className="print-meta-item"><strong>Type:</strong> {selectedTournament.visibility === 'private' ? 'Private' : 'Public'}</span>
          )}
          {startLabel && <span className="print-meta-item"><strong>Starts:</strong> {startLabel}</span>}
          {lockLabel && (
            <span className="print-meta-item">
              <strong>{selectedTournament?.is_locked ? 'Closed:' : 'Locks:'}</strong> {lockLabel}
            </span>
          )}
          {state.totalGoals != null && (
            <span className="print-meta-item"><strong>Total Goals:</strong> {state.totalGoals}</span>
          )}
          {state.topScorer && (
            <span className="print-meta-item"><strong>Top Scorer:</strong> {state.topScorer}</span>
          )}
        </div>
      </header>

      <section className="print-section">
        <h2 className="print-section-title">Group Stage</h2>
        <div className="print-groups-grid">
          {GROUP_LETTERS.map(letter => {
            const group = state.groups[letter];
            return (
              <div key={letter} className="print-group-card">
                <div className="print-group-header">Group {letter}</div>
                <ol className="print-group-list">
                  {group.rankings.map((teamId, idx) => {
                    const team = TEAM_MAP[teamId];
                    return (
                      <li key={teamId} className="print-group-row">
                        <span className="print-group-rank">{idx + 1}</span>
                        {team && <FlagIcon countryCode={team.countryCode} teamName={team.name} size={16} loading="eager" />}
                        <span className="print-group-team">{team?.name ?? '—'}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>
      </section>

      {state.selectedThirdPlace.length > 0 && (
        <section className="print-section">
          <h2 className="print-section-title">Selected 3rd-Place Teams ({state.selectedThirdPlace.length}/8)</h2>
          <div className="print-third-grid">
            {state.selectedThirdPlace.map(groupId => {
              const teamId = state.groups[groupId]?.rankings[2];
              const team = teamId ? TEAM_MAP[teamId] : null;
              return (
                <div key={groupId} className="print-third-card">
                  <span className="print-third-group">Group {groupId}</span>
                  {team && <FlagIcon countryCode={team.countryCode} teamName={team.name} size={16} loading="eager" />}
                  <span className="print-third-team">{team?.name ?? '—'}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="print-section print-section-bracket">
        <h2 className="print-section-title">Knockout Bracket</h2>
        <div className="print-bracket">
          <PrintColumn title="Round of 32" matchIds={R32_IDS} matches={state.matches} showDate />
          <PrintColumn title="Round of 16" matchIds={R16_IDS} matches={state.matches} />
          <PrintColumn title="Quarterfinals" matchIds={QF_IDS} matches={state.matches} />
          <PrintColumn title="Semifinals" matchIds={SF_IDS} matches={state.matches} />
          <div className="print-round-col print-round-col-final">
            <div className="print-round-title">Final &amp; 3rd Place</div>
            <div className="print-round-matches print-round-matches-final">
              <PrintMatch match={finalMatch} emphasis="final" />
              <PrintMatch match={tpoMatch} emphasis="3po" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
