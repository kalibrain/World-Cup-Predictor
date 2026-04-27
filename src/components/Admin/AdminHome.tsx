import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminListTournamentsOverview,
  adminUpsertTournament,
  type TournamentOverviewRow,
  type TournamentStatus,
  type TournamentVisibilityWritable,
} from '../../lib/persistence';
import { fromLocalInputValue } from './dateUtils';

const STATUS_OPTIONS: TournamentStatus[] = ['draft', 'open', 'locked', 'archived'];

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateFormatter.format(d);
};


export function AdminHome() {
  const [rows, setRows] = useState<TournamentOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await adminListTournamentsOverview();
    if (error) setError(error);
    else {
      setError(null);
      setRows(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-title">Admin · Tournaments</h1>
          <p className="admin-subtitle">Oversee every tournament, manage rosters and enter results.</p>
        </div>
        <button
          className="btn btn-gold btn-sm"
          onClick={() => setShowCreate(true)}
          disabled={showCreate}
        >
          New tournament
        </button>
      </div>

      {showCreate && (
        <CreateTournamentForm
          onCancel={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void refresh();
          }}
          submitting={createSubmitting}
          setSubmitting={setCreateSubmitting}
        />
      )}

      {error && <div className="admin-error">{error}</div>}
      {loading && <div className="admin-loading">Loading tournaments…</div>}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Visibility</th>
                <th>Status</th>
                <th>Locks</th>
                <th>Members</th>
                <th>Brackets</th>
                <th>Groups entered</th>
                <th>Matches entered</th>
                <th>Tiebreakers</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="admin-empty">No tournaments yet.</td>
                </tr>
              )}
              {rows.map(row => (
                <tr key={row.tournament_id}>
                  <td>
                    <Link to={`/admin/tournaments/${row.tournament_id}`}>{row.tournament_name}</Link>
                  </td>
                  <td className="admin-cell-mono">{row.visibility}</td>
                  <td className="admin-cell-mono">{row.status}</td>
                  <td>
                    {formatDate(row.locks_at)}
                    {row.is_locked && <span className="admin-pill admin-pill-warn"> Locked</span>}
                  </td>
                  <td>{row.member_count}</td>
                  <td>{row.bracket_count}</td>
                  <td>{row.results_groups_entered} / 12</td>
                  <td>{row.results_matches_entered} / 32</td>
                  <td>{row.tiebreakers_entered ? 'Yes' : 'No'}</td>
                  <td>
                    <Link className="btn btn-outline btn-sm" to={`/admin/tournaments/${row.tournament_id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface CreateFormProps {
  onCancel: () => void;
  onCreated: () => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
}

function CreateTournamentForm({ onCancel, onCreated, submitting, setSubmitting }: CreateFormProps) {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<TournamentVisibilityWritable>('public');
  const [status, setStatus] = useState<TournamentStatus>('open');
  const [startsAt, setStartsAt] = useState('');
  const [locksAt, setLocksAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const locksIso = fromLocalInputValue(locksAt);
    if (!locksIso) {
      setError('Lock date is required.');
      return;
    }
    setSubmitting(true);
    const { error: rpcError } = await adminUpsertTournament({
      id: null,
      name: name.trim(),
      visibility,
      status,
      starts_at: fromLocalInputValue(startsAt),
      locks_at: locksIso,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError);
      return;
    }
    onCreated();
  };

  return (
    <div className="admin-form admin-form-inline">
      <div className="admin-form-row">
        <label className="form-label">Name</label>
        <input
          className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Office Pool 2026"
        />
      </div>
      <div className="admin-form-row admin-form-row-grid">
        <div>
          <label className="form-label">Visibility</label>
          <select
            className="form-input"
            value={visibility}
            onChange={e => setVisibility(e.target.value as TournamentVisibilityWritable)}
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>
        <div>
          <label className="form-label">Status</label>
          <select
            className="form-input"
            value={status}
            onChange={e => setStatus(e.target.value as TournamentStatus)}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="admin-form-row admin-form-row-grid">
        <div>
          <label className="form-label">Starts at (optional)</label>
          <input
            type="datetime-local"
            className="form-input"
            value={startsAt}
            onChange={e => setStartsAt(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Locks at</label>
          <input
            type="datetime-local"
            className="form-input"
            value={locksAt}
            onChange={e => setLocksAt(e.target.value)}
          />
        </div>
      </div>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-form-actions">
        <button className="btn btn-outline btn-sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button className="btn btn-gold btn-sm" onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? 'Creating…' : 'Create'}
        </button>
      </div>
    </div>
  );
}

