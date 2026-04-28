import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { getTournamentLeaderboard, type LeaderboardRow } from '../../lib/persistence';

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

export function LeaderboardPage() {
  const { user } = useAuth();
  const { selectedTournament } = useApp();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tournamentId = selectedTournament?.tournament_id ?? null;

  const refresh = useCallback(async () => {
    if (!tournamentId) {
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
  }, [tournamentId]);

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

        {!loading && !error && !publishedAt && (
          <div className="leaderboard-empty">
            <p>No standings have been published yet. Check back after the first match wraps up.</p>
          </div>
        )}

        {!loading && !error && publishedAt && rows.length === 0 && (
          <div className="leaderboard-empty">
            <p>No participants have a bracket in this tournament yet.</p>
          </div>
        )}

        {!loading && !error && publishedAt && rows.length > 0 && (
          <>
            <div className="leaderboard-table-wrap">
              <table className="admin-table leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Bracket</th>
                    <th>Group pts</th>
                    <th>Knockout pts</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const isMe = row.user_id === user.id;
                    return (
                      <tr key={row.user_id} className={isMe ? 'leaderboard-row-me' : undefined}>
                        <td className="leaderboard-rank">{row.rank_position}</td>
                        <td>
                          {row.display_name ?? row.email ?? row.user_id.slice(0, 8)}
                          {isMe && <span className="leaderboard-you"> (you)</span>}
                        </td>
                        <td>{row.bracket_name ?? <span className="admin-cell-secondary">—</span>}</td>
                        <td>{row.group_points}</td>
                        <td>{row.knockout_points}</td>
                        <td className="leaderboard-total">{row.total_points}</td>
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
                        {row.display_name ?? row.email ?? row.user_id.slice(0, 8)}
                        {isMe && <span className="leaderboard-you"> (you)</span>}
                      </div>
                      <div className="leaderboard-card-total">{row.total_points} pts</div>
                    </div>
                    <div className="leaderboard-card-meta">
                      <span>{row.bracket_name ?? '—'}</span>
                      <span>Group {row.group_points} · Knockout {row.knockout_points}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
