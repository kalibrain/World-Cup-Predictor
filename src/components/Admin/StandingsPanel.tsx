import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminGetStandingsEditor,
  adminPublishStandingsUpdate,
  adminUpsertGroupResult,
  adminUpsertMatchResult,
  adminUpsertTiebreakers,
  adminGetEditionResults,
  type StandingsEditorPayload,
  type TournamentResults,
} from '../../lib/persistence';
import { ALL_TEAMS, createInitialGroups, TEAM_MAP } from '../../data/teams';
import { GroupCard } from '../Groups/GroupCard';
import { FlagIcon } from '../FlagIcon';
import type { Group } from '../../types';

const KNOCKOUT_ROUNDS: Array<{ title: string; ids: string[] }> = [
  { title: 'Round of 32', ids: ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12','M13','M14','M15','M16'] },
  { title: 'Round of 16', ids: ['R16_1','R16_2','R16_3','R16_4','R16_5','R16_6','R16_7','R16_8'] },
  { title: 'Quarterfinals', ids: ['QF1','QF2','QF3','QF4'] },
  { title: 'Semifinals', ids: ['SF1','SF2'] },
  { title: 'Final', ids: ['FINAL'] },
  { title: '3rd Place', ids: ['3PO'] },
];

const GROUP_IDS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFormatter.format(d);
}

function buildGroupFromRankings(groupId: string, ranking: string[] | undefined): Group {
  const initial = createInitialGroups()[groupId];
  if (!ranking || ranking.length !== 4) return initial;
  return { ...initial, rankings: ranking, completed: true };
}

function rankingsEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function StandingsPanel({ editionId }: { editionId: string }) {
  const [data, setData] = useState<StandingsEditorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<'groups' | 'knockout' | 'tiebreakers'>('groups');
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // Local edits (component state) — committed to draft tables only on Save Draft.
  const [localGroups, setLocalGroups] = useState<Record<string, string[]>>({});
  const [localMatches, setLocalMatches] = useState<Record<string, string | null>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: payload, error: err } = await adminGetStandingsEditor(editionId);
    if (err) {
      setError(err);
      setLoading(false);
      return;
    }
    setError(null);
    setData(payload);
    setLocalGroups(payload?.draft_group_results ?? {});
    setLocalMatches(payload?.draft_match_results ?? {});
    setLoading(false);
  }, [editionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const baselineGroups = useMemo(() => data?.draft_group_results ?? {}, [data]);
  const baselineMatches = useMemo(() => data?.draft_match_results ?? {}, [data]);

  const dirtyGroupIds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of Object.keys(localGroups)) {
      if (!rankingsEqual(localGroups[id], baselineGroups[id])) ids.add(id);
    }
    for (const id of Object.keys(baselineGroups)) {
      if (!(id in localGroups)) ids.add(id);
    }
    return ids;
  }, [localGroups, baselineGroups]);

  const dirtyMatchIds = useMemo(() => {
    const ids = new Set<string>();
    const all = new Set<string>([
      ...Object.keys(localMatches),
      ...Object.keys(baselineMatches),
    ]);
    for (const id of all) {
      if ((localMatches[id] ?? null) !== (baselineMatches[id] ?? null)) ids.add(id);
    }
    return ids;
  }, [localMatches, baselineMatches]);

  const isDirty = dirtyGroupIds.size > 0 || dirtyMatchIds.size > 0;

  const groups = useMemo(() => {
    return GROUP_IDS.map(id => buildGroupFromRankings(id, localGroups[id]));
  }, [localGroups]);

  const handleGroupChange = (groupId: string, rankings: string[]) => {
    setLocalGroups(prev => ({ ...prev, [groupId]: rankings }));
  };

  const handleMatchWinner = (matchId: string, winnerId: string | null) => {
    setLocalMatches(prev => ({ ...prev, [matchId]: winnerId }));
  };

  const persistDraft = async (): Promise<string | null> => {
    for (const groupId of dirtyGroupIds) {
      const rankings = localGroups[groupId];
      if (!rankings || rankings.length !== 4) continue;
      const err = await adminUpsertGroupResult(editionId, groupId, rankings);
      if (err) return err;
    }
    for (const matchId of dirtyMatchIds) {
      const winner = localMatches[matchId] ?? null;
      const err = await adminUpsertMatchResult(editionId, matchId, winner);
      if (err) return err;
    }
    return null;
  };

  const showFlash = (message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 4000);
  };

  const handleSaveDraft = async () => {
    setError(null);
    setSavingDraft(true);
    const err = await persistDraft();
    setSavingDraft(false);
    if (err) {
      setError(err);
      return;
    }
    await refresh();
    showFlash('Draft saved.');
  };

  const handlePublish = async () => {
    if (!confirm('Publish standings? This will update the leaderboard everyone sees.')) return;
    setError(null);
    setPublishing(true);

    if (isDirty) {
      const draftErr = await persistDraft();
      if (draftErr) {
        setPublishing(false);
        setError(draftErr);
        return;
      }
    }

    const { publishedAt, error: pubErr } = await adminPublishStandingsUpdate(editionId);
    setPublishing(false);
    if (pubErr) {
      setError(pubErr);
      return;
    }
    await refresh();
    showFlash(publishedAt ? `Published. Leaderboard now reflects standings as of ${formatTimestamp(publishedAt)}.` : 'Published.');
  };

  const draftSavedLabel = data?.draft_updated_at && new Date(data.draft_updated_at).getTime() > 0
    ? `Draft saved ${formatTimestamp(data.draft_updated_at)}`
    : 'No draft saved yet';
  const publishedLabel = data?.published_at
    ? `Published as of ${formatTimestamp(data.published_at)}`
    : 'Not published yet';

  return (
    <div className="admin-panel admin-standings-panel">
      <div className="admin-standings-status">
        <div className="admin-standings-status-row">
          <span className="admin-standings-status-label">{draftSavedLabel}</span>
          <span className="admin-standings-status-divider">·</span>
          <span className="admin-standings-status-label">{publishedLabel}</span>
          {isDirty && <span className="admin-pill admin-pill-warn">Unsaved changes</span>}
        </div>
      </div>

      <nav className="admin-subtabs">
        <button className={`admin-subtab ${section === 'groups' ? 'active' : ''}`} onClick={() => setSection('groups')}>
          Group standings
        </button>
        <button className={`admin-subtab ${section === 'knockout' ? 'active' : ''}`} onClick={() => setSection('knockout')}>
          Knockout winners
        </button>
        <button className={`admin-subtab ${section === 'tiebreakers' ? 'active' : ''}`} onClick={() => setSection('tiebreakers')}>
          Tiebreakers
        </button>
      </nav>

      {flash && <div className="admin-flash">{flash}</div>}
      {error && <div className="admin-error">{error}</div>}
      {loading && <div className="admin-loading">Loading standings…</div>}

      {!loading && section === 'groups' && (
        <>
          <p className="admin-help">Drag teams into final 1–4 order for each group. Changes stay local until you click Save Draft.</p>
          <div className="groups-grid admin-groups-grid">
            {groups.map(g => (
              <div key={g.id} className="admin-group-wrap">
                <GroupCard
                  group={g}
                  onRankingsChange={(groupId, rankings) => handleGroupChange(groupId, rankings)}
                  rankLabel="Drag to set actual order"
                />
                {dirtyGroupIds.has(g.id) && <div className="admin-cell-secondary">Edited</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && section === 'knockout' && (
        <>
          <p className="admin-help">Pick the winner of each match. Changes stay local until you click Save Draft.</p>
          {KNOCKOUT_ROUNDS.map(round => (
            <div key={round.title} className="admin-knockout-round">
              <h3 className="admin-section-title">{round.title}</h3>
              <div className="admin-knockout-grid">
                {round.ids.map(id => (
                  <KnockoutMatchRow
                    key={id}
                    matchId={id}
                    winnerId={localMatches[id] ?? null}
                    edited={dirtyMatchIds.has(id)}
                    onChange={value => handleMatchWinner(id, value)}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {!loading && section === 'tiebreakers' && (
        <TiebreakersForm editionId={editionId} />
      )}

      {!loading && section !== 'tiebreakers' && (
        <div className="admin-standings-actions">
          <div className="admin-standings-actions-meta">
            {isDirty
              ? `${dirtyGroupIds.size + dirtyMatchIds.size} pending change${dirtyGroupIds.size + dirtyMatchIds.size === 1 ? '' : 's'}`
              : 'All changes saved'}
          </div>
          <div className="admin-standings-actions-buttons">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => void handleSaveDraft()}
              disabled={!isDirty || savingDraft || publishing}
            >
              {savingDraft ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              className="btn btn-gold btn-sm"
              onClick={() => void handlePublish()}
              disabled={savingDraft || publishing}
            >
              {publishing ? 'Publishing…' : 'Publish standings update'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface KnockoutRowProps {
  matchId: string;
  winnerId: string | null;
  edited: boolean;
  onChange: (winnerId: string | null) => void;
}

function KnockoutMatchRow({ matchId, winnerId, edited, onChange }: KnockoutRowProps) {
  const team = winnerId ? TEAM_MAP[winnerId] : null;

  return (
    <div className="admin-knockout-row">
      <div className="admin-knockout-id">{matchId}</div>
      <select
        className="form-input"
        value={winnerId ?? ''}
        onChange={e => onChange(e.target.value || null)}
      >
        <option value="">— No winner yet —</option>
        {ALL_TEAMS.map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <div className="admin-knockout-flag">
        {team ? <FlagIcon countryCode={team.countryCode} teamName={team.name} size={20} /> : null}
      </div>
      {edited && <div className="admin-cell-secondary">Edited</div>}
    </div>
  );
}

function TiebreakersForm({ editionId }: { editionId: string }) {
  const [initial, setInitial] = useState<TournamentResults['tiebreakers']>(null);
  const [totalGoals, setTotalGoals] = useState<string>('');
  const [topScorer, setTopScorer] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void adminGetEditionResults(editionId).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) {
        setError(err);
      } else {
        const tb = data?.tiebreakers ?? null;
        setInitial(tb);
        setTotalGoals(tb?.total_goals != null ? String(tb.total_goals) : '');
        setTopScorer(tb?.top_scorer ?? '');
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [editionId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const tg = totalGoals === '' ? null : Math.max(0, Number(totalGoals));
    const err = await adminUpsertTiebreakers(editionId, tg, topScorer.trim());
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setInitial({
      total_goals: tg,
      top_scorer: topScorer.trim(),
      updated_at: initial?.updated_at ?? '',
      updated_by: initial?.updated_by ?? null,
    });
    setSavedAt(Date.now());
  };

  if (loading) return <div className="admin-loading">Loading tiebreakers…</div>;

  return (
    <div className="admin-form">
      <p className="admin-help">Enter once the tournament wraps up. Used to break ties on the leaderboard.</p>
      <div className="admin-form-row">
        <label className="form-label">Total goals scored across all matches</label>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          className="form-input"
          value={totalGoals}
          onChange={e => setTotalGoals(e.target.value)}
          placeholder="e.g. 168"
        />
      </div>
      <div className="admin-form-row">
        <label className="form-label">Top scorer (Golden Boot)</label>
        <input
          type="text"
          maxLength={60}
          className="form-input"
          value={topScorer}
          onChange={e => setTopScorer(e.target.value)}
          placeholder="e.g. Kylian Mbappé"
        />
      </div>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-form-actions">
        <button className="btn btn-gold btn-sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save tiebreakers'}
        </button>
        {savedAt && <span className="admin-cell-secondary">Saved.</span>}
      </div>
    </div>
  );
}
