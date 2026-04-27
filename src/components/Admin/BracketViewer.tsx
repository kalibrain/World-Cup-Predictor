import { useEffect, useMemo, useState } from 'react';
import { adminGetBracket, type AdminBracketRow } from '../../lib/persistence';
import { createInitialMatches } from '../../data/bracket';
import type { Match } from '../../types';
import { BracketView } from '../Bracket/BracketView';

interface Props {
  bracketId: string;
  ownerLabel: string;
  bracketName: string;
  onClose: () => void;
}

function mergeMatches(saved: Record<string, Match> | undefined): Record<string, Match> {
  const initial = createInitialMatches();
  if (!saved) return initial;
  const next = { ...initial };
  for (const [id, m] of Object.entries(saved)) {
    if (!next[id] || !m) continue;
    next[id] = {
      ...next[id],
      ...m,
      slot1: { ...next[id].slot1, ...m.slot1 },
      slot2: { ...next[id].slot2, ...m.slot2 },
    };
  }
  return next;
}

export function BracketViewer({ bracketId, ownerLabel, bracketName, onClose }: Props) {
  const [bracket, setBracket] = useState<AdminBracketRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    adminGetBracket(bracketId).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError(error);
      else if (!data) setError('Bracket not found.');
      else {
        setError(null);
        setBracket(data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [bracketId]);

  const matches = useMemo(() => mergeMatches(bracket?.knockout.matches), [bracket]);

  return (
    <div className="admin-drawer-backdrop" onClick={onClose}>
      <div className="admin-drawer" onClick={e => e.stopPropagation()}>
        <div className="admin-drawer-header">
          <div>
            <div className="admin-drawer-title">{bracketName}</div>
            <div className="admin-cell-secondary">{ownerLabel}</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="admin-drawer-body">
          {loading && <div className="admin-loading">Loading bracket…</div>}
          {error && <div className="admin-error">{error}</div>}
          {bracket && (
            <BracketView
              matches={matches}
              totalGoals={bracket.knockout.total_goals ?? null}
              topScorer={bracket.knockout.top_scorer ?? ''}
              readOnly
              showFooter={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
