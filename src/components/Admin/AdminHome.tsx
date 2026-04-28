import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminCreateEdition,
  adminListEditionsOverview,
  adminListTournamentsOverview,
  adminUpsertTournament,
  type EditionOverviewRow,
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
  const [editions, setEditions] = useState<EditionOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [showCreateEdition, setShowCreateEdition] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [tournamentsRes, editionsRes] = await Promise.all([
      adminListTournamentsOverview(),
      adminListEditionsOverview(),
    ]);
    if (tournamentsRes.error) {
      setError(tournamentsRes.error);
    } else if (editionsRes.error) {
      setError(editionsRes.error);
    } else {
      setError(null);
      setRows(tournamentsRes.data);
      setEditions(editionsRes.data);
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
          <h1 className="admin-title">Admin</h1>
          <p className="admin-subtitle">Editions hold the real-world standings; tournaments are pools that point at an edition.</p>
        </div>
        <div className="admin-form-actions">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowCreateEdition(true)}
            disabled={showCreateEdition}
          >
            New edition
          </button>
          <button
            className="btn btn-gold btn-sm"
            onClick={() => setShowCreate(true)}
            disabled={showCreate}
          >
            New tournament
          </button>
        </div>
      </div>

      {showCreateEdition && (
        <CreateEditionForm
          onCancel={() => setShowCreateEdition(false)}
          onCreated={() => {
            setShowCreateEdition(false);
            void refresh();
          }}
        />
      )}

      {showCreate && (
        <CreateTournamentForm
          editions={editions}
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
      {loading && <div className="admin-loading">Loading…</div>}

      {!loading && !error && (
        <>
          <h2 className="admin-section-title">Editions</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Edition</th>
                  <th>Tournaments</th>
                  <th>Groups entered</th>
                  <th>Matches entered</th>
                  <th>Tiebreakers</th>
                  <th>Last published</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {editions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="admin-empty">No editions yet.</td>
                  </tr>
                )}
                {editions.map(e => (
                  <tr key={e.edition_id}>
                    <td>
                      <Link to={`/admin/editions/${e.edition_id}/standings`}>{e.edition_name}</Link>
                    </td>
                    <td>{e.tournament_count}</td>
                    <td>{e.results_groups_entered} / 12</td>
                    <td>{e.results_matches_entered} / 32</td>
                    <td>{e.tiebreakers_entered ? 'Yes' : 'No'}</td>
                    <td>{formatDate(e.published_at)}</td>
                    <td>
                      <Link className="btn btn-outline btn-sm" to={`/admin/editions/${e.edition_id}/standings`}>
                        Manage standings
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="admin-section-title">Tournaments</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Edition</th>
                  <th>Visibility</th>
                  <th>Status</th>
                  <th>Locks</th>
                  <th>Members</th>
                  <th>Brackets</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="admin-empty">No tournaments yet.</td>
                  </tr>
                )}
                {rows.map(row => (
                  <tr key={row.tournament_id}>
                    <td>
                      <Link to={`/admin/tournaments/${row.tournament_id}`}>{row.tournament_name}</Link>
                    </td>
                    <td>
                      <Link to={`/admin/editions/${row.edition_id}/standings`}>{row.edition_name}</Link>
                    </td>
                    <td className="admin-cell-mono">{row.visibility}</td>
                    <td className="admin-cell-mono">{row.status}</td>
                    <td>
                      {formatDate(row.locks_at)}
                      {row.is_locked && <span className="admin-pill admin-pill-warn"> Locked</span>}
                    </td>
                    <td>{row.member_count}</td>
                    <td>{row.bracket_count}</td>
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
        </>
      )}
    </div>
  );
}

interface CreateFormProps {
  editions: EditionOverviewRow[];
  onCancel: () => void;
  onCreated: () => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
}

function CreateTournamentForm({ editions, onCancel, onCreated, submitting, setSubmitting }: CreateFormProps) {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<TournamentVisibilityWritable>('public');
  const [status, setStatus] = useState<TournamentStatus>('open');
  const [startsAt, setStartsAt] = useState('');
  const [locksAt, setLocksAt] = useState('');
  const [editionId, setEditionId] = useState<string>(editions[0]?.edition_id ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!editionId) {
      setError('Pick an edition.');
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
      edition_id: editionId,
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
      <div className="admin-form-row">
        <label className="form-label">Edition</label>
        <select
          className="form-input"
          value={editionId}
          onChange={e => setEditionId(e.target.value)}
        >
          {editions.length === 0 && <option value="">No editions available</option>}
          {editions.map(e => (
            <option key={e.edition_id} value={e.edition_id}>{e.edition_name}</option>
          ))}
        </select>
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

interface CreateEditionFormProps {
  onCancel: () => void;
  onCreated: () => void;
}

function CreateEditionForm({ onCancel, onCreated }: CreateEditionFormProps) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSubmitting(true);
    const { error: rpcError } = await adminCreateEdition(name.trim());
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
        <label className="form-label">Edition name</label>
        <input
          className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. FIFA World Cup 2030"
        />
      </div>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-form-actions">
        <button className="btn btn-outline btn-sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button className="btn btn-gold btn-sm" onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? 'Creating…' : 'Create edition'}
        </button>
      </div>
    </div>
  );
}
