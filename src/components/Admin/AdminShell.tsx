import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminHome } from './AdminHome';
import { TournamentDrilldown } from './TournamentDrilldown';
import { EditionStandingsPage } from './EditionStandingsPage';

export function AdminShell() {
  return (
    <main className="app-main admin-main">
      <Routes>
        <Route index element={<AdminHome />} />
        <Route path="tournaments/:tournamentId/*" element={<TournamentDrilldown />} />
        <Route path="editions/:editionId/standings" element={<EditionStandingsPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </main>
  );
}
