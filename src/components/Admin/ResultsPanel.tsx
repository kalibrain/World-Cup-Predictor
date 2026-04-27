import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminGetTournamentResults,
  adminUpsertGroupResult,
  adminUpsertMatchResult,
  adminUpsertTiebreakers,
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

function buildGroupFromResults(groupId: string, ranking: string[] | undefined): Group {
  const initial = createInitialGroups()[groupId];
  if (!ranking || ranking.length !== 4) return initial;
  return { ...initial, rankings: ranking, completed: true };
}

export function ResultsPanel({ tournamentId }: { tournamentId: string }) {
  const [results, setResults] = useState<TournamentResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [section, setSection] = useState<'groups' | 'knockout' | 'tiebreakers'>('groups');

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await adminGetTournamentResults(tournamentId);
    if (error) setError(error);
    else {
      setError(null);
      setResults(data);
    }
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const groups = useMemo(() => {
    const ids = ['A','B','C','D','E','F','G','H','I','J','K','L'];
    return ids.map(id => buildGroupFromResults(id, results?.group_results[id]));
  }, [results]);

  const handleGroupChange = async (groupId: string, rankings: string[]) => {
    setSavingKey(`group-${groupId}`);
    setError(null);
    const err = await adminUpsertGroupResult(tournamentId, groupId, rankings);
    setSavingKey(null);
    if (err) {
      setError(err);
      return;
    }
    setResults(prev => ({
      group_results: { ...(prev?.group_results ?? {}), [groupId]: rankings },
      match_results: prev?.match_results ?? {},
      tiebreakers: prev?.tiebreakers ?? null,
    }));
  };

  const handleMatchWinner = async (matchId: string, winnerId: string | null) => {
    setSavingKey(`match-${matchId}`);
    setError(null);
    const err = await adminUpsertMatchResult(tournamentId, matchId, winnerId);
    setSavingKey(null);
    if (err) {
      setError(err);
      return;
    }
    setResults(prev => ({
      group_results: prev?.group_results ?? {},
      match_results: { ...(prev?.match_results ?? {}), [matchId]: winnerId },
      tiebreakers: prev?.tiebreakers ?? null,
    }));
  };

  return (
    <div className="admin-panel">
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

      {error && <div className="admin-error">{error}</div>}
      {loading && <div className="admin-loading">Loading results…</div>}

      {!loading && section === 'groups' && (
        <>
          <p className="admin-help">Drag teams into final 1–4 order for each group. Saves on every reorder.</p>
          <div className="groups-grid admin-groups-grid">
            {groups.map(g => (
              <div key={g.id} className="admin-group-wrap">
                <GroupCard
                  group={g}
                  onRankingsChange={(groupId, rankings) => void handleGroupChange(groupId, rankings)}
                  rankLabel="Drag to set actual order"
                />
                {savingKey === `group-${g.id}` && <div className="admin-cell-secondary">Saving…</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && section === 'knockout' && (
        <>
          <p className="admin-help">Pick the winner of each match. Use the dropdown — slots auto-fill once group results are known.</p>
          {KNOCKOUT_ROUNDS.map(round => (
            <div key={round.title} className="admin-knockout-round">
              <h3 className="admin-section-title">{round.title}</h3>
              <div className="admin-knockout-grid">
                {round.ids.map(id => (
                  <KnockoutMatchRow
                    key={id}
                    matchId={id}
                    winnerId={results?.match_results[id] ?? null}
                    saving={savingKey === `match-${id}`}
                    onChange={value => void handleMatchWinner(id, value)}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {!loading && section === 'tiebreakers' && (
        <TiebreakersForm
          tournamentId={tournamentId}
          initial={results?.tiebreakers ?? null}
          onSaved={values =>
            setResults(prev => ({
              group_results: prev?.group_results ?? {},
              match_results: prev?.match_results ?? {},
              tiebreakers: { ...(prev?.tiebreakers ?? { updated_at: '', updated_by: null }), ...values },
            }))
          }
        />
      )}
    </div>
  );
}

interface KnockoutRowProps {
  matchId: string;
  winnerId: string | null;
  saving: boolean;
  onChange: (winnerId: string | null) => void;
}

function KnockoutMatchRow({ matchId, winnerId, saving, onChange }: KnockoutRowProps) {
  const team = winnerId ? TEAM_MAP[winnerId] : null;

  return (
    <div className="admin-knockout-row">
      <div className="admin-knockout-id">{matchId}</div>
      <select
        className="form-input"
        value={winnerId ?? ''}
        onChange={e => onChange(e.target.value || null)}
        disabled={saving}
      >
        <option value="">— No winner yet —</option>
        {ALL_TEAMS.map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <div className="admin-knockout-flag">
        {team ? <FlagIcon countryCode={team.countryCode} teamName={team.name} size={20} /> : null}
      </div>
      {saving && <div className="admin-cell-secondary">Saving…</div>}
    </div>
  );
}

interface TiebreakersFormProps {
  tournamentId: string;
  initial: TournamentResults['tiebreakers'];
  onSaved: (values: { total_goals: number | null; top_scorer: string }) => void;
}

function TiebreakersForm({ tournamentId, initial, onSaved }: TiebreakersFormProps) {
  const [totalGoals, setTotalGoals] = useState<string>(initial?.total_goals != null ? String(initial.total_goals) : '');
  const [topScorer, setTopScorer] = useState<string>(initial?.top_scorer ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTotalGoals(initial?.total_goals != null ? String(initial.total_goals) : '');
    setTopScorer(initial?.top_scorer ?? '');
  }, [initial]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const tg = totalGoals === '' ? null : Math.max(0, Number(totalGoals));
    const err = await adminUpsertTiebreakers(tournamentId, tg, topScorer.trim());
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    onSaved({ total_goals: tg, top_scorer: topScorer.trim() });
    setSavedAt(Date.now());
  };

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
