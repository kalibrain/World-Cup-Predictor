import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminArchiveTournament,
  adminUpsertTournament,
  type TournamentOverviewRow,
  type TournamentStatus,
  type TournamentVisibilityWritable,
} from '../../lib/persistence';
import { fromLocalInputValue, toLocalInputValue } from './dateUtils';

const STATUS_OPTIONS: TournamentStatus[] = ['draft', 'open', 'locked', 'archived'];

interface Props {
  tournament: TournamentOverviewRow;
  onChanged: () => void;
}

export function SettingsPanel({ tournament, onChanged }: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState(tournament.tournament_name);
  const [visibility, setVisibility] = useState<TournamentVisibilityWritable>(tournament.visibility);
  const [status, setStatus] = useState<TournamentStatus>(tournament.status);
  const [startsAt, setStartsAt] = useState(toLocalInputValue(tournament.starts_at));
  const [locksAt, setLocksAt] = useState(toLocalInputValue(tournament.locks_at));
  const [maxBrackets, setMaxBrackets] = useState(String(tournament.max_brackets_per_user));
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const handleSave = async () => {
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
    const maxBracketCount = Number.parseInt(maxBrackets, 10);
    if (!Number.isInteger(maxBracketCount) || maxBracketCount < 1) {
      setError('Bracket limit must be at least 1.');
      return;
    }
    setSaving(true);
    const { error: rpcError } = await adminUpsertTournament({
      id: tournament.tournament_id,
      name: name.trim(),
      visibility,
      status,
      starts_at: fromLocalInputValue(startsAt),
      locks_at: locksIso,
      edition_id: tournament.edition_id,
      max_brackets_per_user: maxBracketCount,
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError);
      return;
    }
    setSavedAt(Date.now());
    onChanged();
  };

  const handleArchive = async () => {
    if (!confirm('Archive this tournament? It will stop appearing for participants but is reversible by re-saving with status “open”.')) {
      return;
    }
    setArchiving(true);
    const err = await adminArchiveTournament(tournament.tournament_id);
    setArchiving(false);
    if (err) {
      setError(err);
      return;
    }
    navigate('/admin');
  };

  return (
    <div className="admin-form">
      <div className="admin-form-row">
        <label className="form-label">Name</label>
        <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
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
      <div className="admin-form-row">
        <label className="form-label">Brackets per user</label>
        <input
          type="number"
          min={1}
          className="form-input"
          value={maxBrackets}
          onChange={e => setMaxBrackets(e.target.value)}
        />
      </div>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-form-actions">
        <button className="btn btn-gold btn-sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {savedAt && <span className="admin-cell-secondary">Saved.</span>}
        <div className="admin-form-spacer" />
        <button
          className="btn btn-outline btn-sm admin-action-danger"
          onClick={() => void handleArchive()}
          disabled={archiving || tournament.status === 'archived'}
        >
          {tournament.status === 'archived' ? 'Already archived' : (archiving ? 'Archiving…' : 'Archive tournament')}
        </button>
      </div>
    </div>
  );
}
