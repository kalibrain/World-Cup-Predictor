import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';

export function SaveStatus() {
  const { isSaving, persistError } = useApp();
  const [showSaved, setShowSaved] = useState(false);
  const wasSavingRef = useRef(false);

  useEffect(() => {
    if (isSaving) {
      wasSavingRef.current = true;
      return;
    }

    if (!wasSavingRef.current) return;
    wasSavingRef.current = false;

    const savedTimer = window.setTimeout(() => setShowSaved(true), 0);
    const idleTimer = window.setTimeout(() => setShowSaved(false), 1200);
    return () => {
      window.clearTimeout(savedTimer);
      window.clearTimeout(idleTimer);
    };
  }, [isSaving]);

  if (persistError) {
    return (
      <div className="save-status save-status-error" role="status" aria-live="polite">
        <span aria-hidden="true">⚠</span>
        Save failed
      </div>
    );
  }

  if (!isSaving && !showSaved) return null;

  const status = isSaving ? 'saving' : 'saved';

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
