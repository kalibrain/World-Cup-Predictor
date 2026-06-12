import type { AppState } from '../types';

export function isBracketComplete(state: AppState): boolean {
  return state.bracketName.trim().length > 0
    && Object.values(state.groups).every(group => group.rankings.length === 4)
    && state.selectedThirdPlace.length === 8
    && Object.entries(state.matches).every(([matchId, match]) => matchId === '3PO' || Boolean(match.winnerId));
}
