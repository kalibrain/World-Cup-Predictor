import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminHome } from './AdminHome';
import { TournamentDrilldown } from './TournamentDrilldown';

export function AdminShell() {
  return (
    <main className="app-main admin-main">
      <Routes>
        <Route index element={<AdminHome />} />
        <Route path="tournaments/:tournamentId/*" element={<TournamentDrilldown />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </main>
  );
}
