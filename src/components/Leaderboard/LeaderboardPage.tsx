import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createInitialMatches } from '../../data/bracket';
import { TEAM_MAP } from '../../data/teams';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  getTournamentLeaderboard,
  getTournamentLeaderboardBracket,
  type AdminBracketRow,
  type LeaderboardRow,
} from '../../lib/persistence';
import { isBracketComplete } from '../../utils/bracketCompletion';
import type { Match } from '../../types';
import { BracketView } from '../Bracket/BracketView';

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

function formatPublishedAt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return dateTimeFormatter.format(d);
}

function displayName(row: LeaderboardRow): string {
  return row.display_name ?? row.email ?? row.user_id.slice(0, 8);
}

function teamName(teamId: string | null | undefined): string {
  if (!teamId) return '';
  return TEAM_MAP[teamId]?.name ?? teamId;
}

function TeamName({ teamId }: { teamId: string | null | undefined }) {
  const name = teamName(teamId);
  return name ? <span className="leaderboard-team-name">{name}</span> : <span className="admin-cell-secondary">—</span>;
}

function FinalistsCell({ row }: { row: LeaderboardRow }) {
  const finalist1 = teamName(row.predicted_finalist_1);
  const finalist2 = teamName(row.predicted_finalist_2);

  if (!finalist1 || !finalist2) {
    return <span className="admin-cell-secondary">—</span>;
  }

  return (
    <span className="leaderboard-finalists" aria-label={`Finalists: ${finalist1} versus ${finalist2}`}>
      {finalist1} vs {finalist2}
    </span>
  );
}

function MobileFinalPick({ row }: { row: LeaderboardRow }) {
  const finalist1 = teamName(row.predicted_finalist_1);
  const finalist2 = teamName(row.predicted_finalist_2);
  const champion = teamName(row.predicted_champion);

  if (!finalist1 || !finalist2) {
    return <span className="admin-cell-secondary">—</span>;
  }

  const runnerUp = champion === finalist1 ? finalist2 : finalist1;

  if (!champion) {
    return <span className="leaderboard-finalists">{finalist1} vs {finalist2}</span>;
  }

  return (
    <span className="leaderboard-mobile-finalists" aria-label={`Champion: ${champion}. Finalists: ${finalist1} versus ${finalist2}`}>
      <strong>{champion}</strong>
      <span> - {runnerUp}</span>
    </span>
  );
}

function mergeMatches(saved: Record<string, Match> | undefined): Record<string, Match> {
  const initial = createInitialMatches();
  if (!saved) return initial;
  const next = { ...initial };
  for (const [id, m] of Object.entries(saved)) {
    if (!next[id] || !m) continue;
    next[id] = {
      ...next[id],
      ...m,
      slot1: { ...next[id].slot1, ...m.slot1 },
      slot2: { ...next[id].slot2, ...m.slot2 },
    };
  }
  return next;
}

interface BracketDrawerProps {
  tournamentId: string;
  rows: LeaderboardRow[];
  selectedBracketId: string;
  currentUserId: string;
  onSelectBracket: (bracketId: string) => void;
  onClose: () => void;
}

function LeaderboardBracketDrawer({
  tournamentId,
  rows,
  selectedBracketId,
  currentUserId,
  onSelectBracket,
  onClose,
}: BracketDrawerProps) {
  const selectedRow = useMemo(
    () => rows.find(row => row.bracket_id === selectedBracketId) ?? null,
    [rows, selectedBracketId],
  );
  const [bracket, setBracket] = useState<AdminBracketRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setBracket(null);
    setError(null);
    getTournamentLeaderboardBracket(tournamentId, selectedBracketId).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError(error);
      else if (!data) setError('Bracket not found.');
      else setBracket(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedBracketId, tournamentId]);

  const matches = useMemo(() => mergeMatches(bracket?.knockout.matches), [bracket]);

  if (!selectedRow) return null;

  return (
    <div className="leaderboard-drawer-backdrop" onClick={onClose}>
      <div className="leaderboard-drawer" onClick={e => e.stopPropagation()}>
        <div className="leaderboard-drawer-header">
          <div>
            <div className="leaderboard-drawer-title">
              {selectedRow.bracket_name ?? 'Bracket'}
            </div>
            <div className="admin-cell-secondary">
              {displayName(selectedRow)}
              {selectedRow.user_id === currentUserId ? ' (you)' : ''}
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="leaderboard-drawer-shell">
          <aside className="leaderboard-viewer-list" aria-label="Participant brackets">
            {rows.map(row => {
              if (!row.bracket_id) return null;
              const isActive = row.bracket_id === selectedBracketId;
              return (
                <button
                  key={row.bracket_id}
                  type="button"
                  className={`leaderboard-viewer-item ${isActive ? 'leaderboard-viewer-item-active' : ''}`}
                  onClick={() => onSelectBracket(row.bracket_id as string)}
                >
                  <span className="leaderboard-viewer-rank">#{row.rank_position}</span>
                  <span className="leaderboard-viewer-name">
                    {displayName(row)}
                    {row.user_id === currentUserId ? ' (you)' : ''}
                  </span>
                  <span className="leaderboard-viewer-score">{row.total_points} pts</span>
                </button>
              );
            })}
          </aside>
          <div className="leaderboard-drawer-body">
            {loading && <div className="admin-loading">Loading bracket…</div>}
            {error && <div className="admin-error">{error}</div>}
            {bracket && (
              <BracketView
                matches={matches}
                totalGoals={bracket.knockout.total_goals ?? null}
                topScorer={bracket.knockout.top_scorer ?? ''}
                readOnly
                showFooter={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LeaderboardPage() {
  const { user } = useAuth();
  const { state, selectedTournament } = useApp();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBracketId, setSelectedBracketId] = useState<string | null>(null);

  const tournamentId = selectedTournament?.tournament_id ?? null;
  const leaderboardUnlocked = Boolean(selectedTournament?.is_locked);
  const currentBracketComplete = isBracketComplete(state);

  const refresh = useCallback(async () => {
    if (!tournamentId || !leaderboardUnlocked || !currentBracketComplete) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, publishedAt: pubAt, error: err } = await getTournamentLeaderboard(tournamentId);
    if (err) {
      setError(err);
    } else {
      setError(null);
      setRows(data);
      setPublishedAt(pubAt);
    }
    setLoading(false);
  }, [currentBracketComplete, leaderboardUnlocked, tournamentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  if (!user) {
    return (
      <main className="app-main">
        <div className="leaderboard-page">
          <div className="leaderboard-empty">
            <p>Sign in to view the leaderboard.</p>
            <Link to="/" className="btn btn-gold btn-sm">Back to home</Link>
          </div>
        </div>
      </main>
    );
  }

  if (!selectedTournament) {
    return (
      <main className="app-main">
        <div className="leaderboard-page">
          <div className="leaderboard-empty">
            <p>Select a tournament first to see its leaderboard.</p>
            <Link to="/" className="btn btn-gold btn-sm">Pick a tournament</Link>
          </div>
        </div>
      </main>
    );
  }

  if (!leaderboardUnlocked) {
    return (
      <main className="app-main">
        <div className="leaderboard-page">
          <div className="leaderboard-empty">
            <p>Leaderboard opens after lockout.</p>
            <div className="admin-cell-secondary">
              Lockout: {formatPublishedAt(selectedTournament.locks_at)}
            </div>
            <Link to="/" className="btn btn-gold btn-sm">Back to bracket</Link>
          </div>
        </div>
      </main>
    );
  }

  if (!currentBracketComplete) {
    return (
      <main className="app-main">
        <div className="leaderboard-page">
          <div className="leaderboard-empty">
            <p>Only participants who submitted a completed bracket before lockout can view the leaderboard.</p>
            <Link to="/" className="btn btn-gold btn-sm">Back to bracket</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-main">
      <div className="leaderboard-page">
        <header className="leaderboard-header">
          <div className="leaderboard-header-text">
            <div className="leaderboard-eyebrow">{selectedTournament.tournament_name}</div>
            <h1 className="leaderboard-title">Leaderboard</h1>
            <div className="leaderboard-meta">
              <span className="admin-pill admin-pill-warn">Provisional standings</span>
              {publishedAt && (
                <span className="leaderboard-asof">
                  As of {formatPublishedAt(publishedAt)}
                </span>
              )}
            </div>
            <p className="leaderboard-disclaimer">
              Scores are provisional and may change as the admin publishes new updates throughout the tournament.
            </p>
          </div>
          <Link to="/" className="btn btn-outline btn-sm leaderboard-back">
            Back
          </Link>
        </header>

        {error && <div className="admin-error">{error}</div>}
        {loading && <div className="admin-loading">Loading leaderboard…</div>}

        {!loading && !error && rows.length === 0 && (
          <div className="leaderboard-empty">
            <p>No completed brackets are available for this tournament yet.</p>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <div className="leaderboard-table-wrap">
              <table className="admin-table leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Bracket</th>
                    <th>Finalists</th>
                    <th>Champion</th>
                    <th>Total</th>
                    <th>View</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const isMe = row.user_id === user.id;
                    return (
                      <tr key={row.user_id} className={isMe ? 'leaderboard-row-me' : undefined}>
                        <td className="leaderboard-rank">{row.rank_position}</td>
                        <td>
                          {displayName(row)}
                          {isMe && <span className="leaderboard-you"> (you)</span>}
                        </td>
                        <td>{row.bracket_name ?? <span className="admin-cell-secondary">—</span>}</td>
                        <td><FinalistsCell row={row} /></td>
                        <td><TeamName teamId={row.predicted_champion} /></td>
                        <td className="leaderboard-total">{row.total_points}</td>
                        <td>
                          {row.bracket_id && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => setSelectedBracketId(row.bracket_id)}
                            >
                              View
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="leaderboard-cards">
              {rows.map(row => {
                const isMe = row.user_id === user.id;
                return (
                  <li key={row.user_id} className={`leaderboard-card ${isMe ? 'leaderboard-row-me' : ''}`}>
                    <div className="leaderboard-card-top">
                      <div className="leaderboard-card-rank">#{row.rank_position}</div>
                      <div className="leaderboard-card-name">
                        {displayName(row)}
                        {isMe && <span className="leaderboard-you"> (you)</span>}
                      </div>
                      <div className="leaderboard-card-total">{row.total_points} pts</div>
                    </div>
                    <div className="leaderboard-card-meta">
                      <span>{row.bracket_name ?? '—'}</span>
                      <MobileFinalPick row={row} />
                    </div>
                    {row.bracket_id && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm leaderboard-card-view"
                        onClick={() => setSelectedBracketId(row.bracket_id)}
                      >
                        View Bracket
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      {selectedBracketId && (
        <LeaderboardBracketDrawer
          tournamentId={selectedTournament.tournament_id}
          rows={rows}
          selectedBracketId={selectedBracketId}
          currentUserId={user.id}
          onSelectBracket={setSelectedBracketId}
          onClose={() => setSelectedBracketId(null)}
        />
      )}
    </main>
  );
}
