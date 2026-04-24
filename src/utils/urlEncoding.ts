import type { AppState } from '../types';

export function encodeState(state: AppState): string {
  const json = JSON.stringify(state);
  // Use btoa with UTF-8 encoding for unicode support
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

export function decodeState(encoded: string): AppState | null {
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as AppState;
    // Backfill furthestStep for older shared links
    if (!parsed.furthestStep) {
      parsed.furthestStep = parsed.step;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildShareUrl(state: AppState): string {
  const encoded = encodeState(state);
  const base = window.location.origin + window.location.pathname;
  return `${base}#/share?d=${encoded}`;
}

export function getSharedStateFromUrl(): AppState | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#/share?d=')) return null;
  const encoded = hash.slice('#/share?d='.length);
  if (!encoded) return null;
  return decodeState(encoded);
}
