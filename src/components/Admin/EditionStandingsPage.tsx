import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  adminListEditionsOverview,
  type EditionOverviewRow,
} from '../../lib/persistence';
import { StandingsPanel } from './StandingsPanel';

export function EditionStandingsPage() {
  const { editionId } = useParams<{ editionId: string }>();
  const [edition, setEdition] = useState<EditionOverviewRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!editionId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void adminListEditionsOverview().then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) {
        setError(err);
      } else {
        const found = data.find(e => e.edition_id === editionId) ?? null;
        setEdition(found);
        if (!found) setError('Edition not found.');
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [editionId]);

  if (!editionId) return <Navigate to="/admin" replace />;

  return (
    <div className="admin-page">
      <div className="admin-breadcrumbs">
        <Link to="/admin">← Admin home</Link>
      </div>

      {loading && <div className="admin-loading">Loading edition…</div>}
      {error && <div className="admin-error">{error}</div>}

      {edition && (
        <>
          <div className="admin-page-header">
            <div>
              <h1 className="admin-title">Standings · {edition.edition_name}</h1>
              <p className="admin-subtitle">
                Used by {edition.tournament_count} tournament{edition.tournament_count === 1 ? '' : 's'}
                {edition.published_at ? ' · last published' : ''}
              </p>
            </div>
          </div>
          <StandingsPanel editionId={editionId} />
        </>
      )}
    </div>
  );
}
