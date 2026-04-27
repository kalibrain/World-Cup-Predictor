import { useCallback, useEffect, useState } from 'react';
import {
  adminDeleteBracket,
  adminListTournamentMembers,
  adminRevokeMembership,
  type TournamentMemberRow,
} from '../../lib/persistence';
import { BracketViewer } from './BracketViewer';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function MembersPanel({ tournamentId }: { tournamentId: string }) {
  const [members, setMembers] = useState<TournamentMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [viewBracket, setViewBracket] = useState<TournamentMemberRow | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await adminListTournamentMembers(tournamentId);
    if (error) setError(error);
    else {
      setError(null);
      setMembers(data);
    }
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const handleRevoke = async (member: TournamentMemberRow) => {
    if (!confirm(`Revoke access for ${member.email ?? member.user_id}? Their bracket will remain unless you also delete it.`)) {
      return;
    }
    setActionUserId(member.user_id);
    const error = await adminRevokeMembership(tournamentId, member.user_id);
    setActionUserId(null);
    if (error) {
      setError(error);
      return;
    }
    void refresh();
  };

  const handleDeleteBracket = async (member: TournamentMemberRow) => {
    if (!member.bracket_id) return;
    if (!confirm(`Delete ${member.bracket_name ?? 'bracket'} for ${member.email ?? member.user_id}? This cannot be undone.`)) {
      return;
    }
    setActionUserId(member.user_id);
    const error = await adminDeleteBracket(member.bracket_id);
    setActionUserId(null);
    if (error) {
      setError(error);
      return;
    }
    void refresh();
  };

  return (
    <div className="admin-panel">
      {error && <div className="admin-error">{error}</div>}
      {loading && <div className="admin-loading">Loading members…</div>}

      {!loading && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Bracket</th>
                <th>Last update</th>
                <th>Furthest step</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 && (
                <tr>
                  <td colSpan={7} className="admin-empty">No members yet.</td>
                </tr>
              )}
              {members.map(m => {
                const busy = actionUserId === m.user_id;
                return (
                  <tr key={m.user_id}>
                    <td>
                      <div>{m.display_name ?? m.email ?? m.user_id}</div>
                      {m.email && m.display_name && (
                        <div className="admin-cell-secondary">{m.email}</div>
                      )}
                    </td>
                    <td className="admin-cell-mono">{m.role}</td>
                    <td>{dateFormatter.format(new Date(m.joined_at))}</td>
                    <td>{m.bracket_name ?? <span className="admin-cell-secondary">—</span>}</td>
                    <td>{m.bracket_updated_at ? dateFormatter.format(new Date(m.bracket_updated_at)) : '—'}</td>
                    <td className="admin-cell-mono">{m.bracket_furthest_step ?? '—'}</td>
                    <td className="admin-cell-actions">
                      {m.bracket_id && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setViewBracket(m)}
                          disabled={busy}
                        >
                          View
                        </button>
                      )}
                      {m.bracket_id && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => void handleDeleteBracket(m)}
                          disabled={busy}
                        >
                          Delete bracket
                        </button>
                      )}
                      <button
                        className="btn btn-outline btn-sm admin-action-danger"
                        onClick={() => void handleRevoke(m)}
                        disabled={busy}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewBracket?.bracket_id && (
        <BracketViewer
          bracketId={viewBracket.bracket_id}
          ownerLabel={viewBracket.display_name ?? viewBracket.email ?? viewBracket.user_id}
          bracketName={viewBracket.bracket_name ?? 'Bracket'}
          onClose={() => setViewBracket(null)}
        />
      )}
    </div>
  );
}
