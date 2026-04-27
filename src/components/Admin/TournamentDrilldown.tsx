import { useEffect, useState } from 'react';
import { Link, NavLink, Routes, Route, Navigate, useParams } from 'react-router-dom';
import {
  adminListTournamentsOverview,
  type TournamentOverviewRow,
} from '../../lib/persistence';
import { MembersPanel } from './MembersPanel';
import { ResultsPanel } from './ResultsPanel';
import { SettingsPanel } from './SettingsPanel';

export function TournamentDrilldown() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [tournament, setTournament] = useState<TournamentOverviewRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;
    adminListTournamentsOverview().then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError(error);
      else {
        const found = data.find(t => t.tournament_id === tournamentId) ?? null;
        setTournament(found);
        if (!found) setError('Tournament not found.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, reloadKey]);

  if (!tournamentId) return <Navigate to="/admin" replace />;

  return (
    <div className="admin-page">
      <div className="admin-breadcrumbs">
        <Link to="/admin">← All tournaments</Link>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {tournament && (
        <>
          <div className="admin-page-header">
            <div>
              <h1 className="admin-title">{tournament.tournament_name}</h1>
              <p className="admin-subtitle">
                {tournament.visibility} · {tournament.status} · {tournament.member_count} members · {tournament.bracket_count} brackets
              </p>
            </div>
          </div>

          <nav className="admin-tabs">
            <NavLink
              end
              to={`/admin/tournaments/${tournamentId}`}
              className={({ isActive }) => `admin-tab ${isActive ? 'active' : ''}`}
            >
              Members
            </NavLink>
            <NavLink
              to={`/admin/tournaments/${tournamentId}/results`}
              className={({ isActive }) => `admin-tab ${isActive ? 'active' : ''}`}
            >
              Results
            </NavLink>
            <NavLink
              to={`/admin/tournaments/${tournamentId}/settings`}
              className={({ isActive }) => `admin-tab ${isActive ? 'active' : ''}`}
            >
              Settings
            </NavLink>
          </nav>

          <Routes>
            <Route index element={<MembersPanel tournamentId={tournamentId} />} />
            <Route path="results" element={<ResultsPanel tournamentId={tournamentId} />} />
            <Route
              path="settings"
              element={
                <SettingsPanel
                  tournament={tournament}
                  onChanged={() => setReloadKey(k => k + 1)}
                />
              }
            />
          </Routes>
        </>
      )}
    </div>
  );
}
