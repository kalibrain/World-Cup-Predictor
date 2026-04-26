import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

type Status = 'idle' | 'saving' | 'saved';

export function SaveStatus() {
  const { isSaving, persistError } = useApp();
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (isSaving) {
      setStatus('saving');
      return;
    }
    if (status !== 'saving') return;
    setStatus('saved');
    const timer = window.setTimeout(() => setStatus('idle'), 1200);
    return () => window.clearTimeout(timer);
  }, [isSaving, status]);

  if (persistError) {
    return (
      <div className="save-status save-status-error" role="status" aria-live="polite">
        <span aria-hidden="true">⚠</span>
        Save failed
      </div>
    );
  }

  if (status === 'idle') return null;

  return (
    <div className={`save-status save-status-${status}`} role="status" aria-live="polite">
      {status === 'saving' ? (
        <>
          <span className="save-status-spinner" aria-hidden="true" />
          Saving…
        </>
      ) : (
        <>
          <span className="save-status-check" aria-hidden="true">✓</span>
          Saved
        </>
      )}
    </div>
  );
}
