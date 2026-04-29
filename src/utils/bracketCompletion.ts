import type { AppState } from '../types';

export function isBracketComplete(state: AppState): boolean {
  return state.bracketName.trim().length > 0
    && Object.values(state.groups).every(group => group.rankings.length === 4)
    && state.selectedThirdPlace.length === 8
    && Object.values(state.matches).every(match => Boolean(match.winnerId))
    && state.totalGoals !== null
    && state.topScorer.trim().length > 0;
}
