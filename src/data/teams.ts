import type { Team, Group } from '../types';

export const ALL_TEAMS: Team[] = [
  // Group A
  { id: 'mexico', name: 'Mexico', flag: '🇲🇽', group: 'A' },
  { id: 'south-africa', name: 'South Africa', flag: '🇿🇦', group: 'A' },
  { id: 'south-korea', name: 'South Korea', flag: '🇰🇷', group: 'A' },
  { id: 'czech-republic', name: 'Czech Republic', flag: '🇨🇿', group: 'A' },
  // Group B
  { id: 'canada', name: 'Canada', flag: '🇨🇦', group: 'B' },
  { id: 'bosnia', name: 'Bosnia and Herzegovina', flag: '🇧🇦', group: 'B' },
  { id: 'qatar', name: 'Qatar', flag: '🇶🇦', group: 'B' },
  { id: 'switzerland', name: 'Switzerland', flag: '🇨🇭', group: 'B' },
  // Group C
  { id: 'brazil', name: 'Brazil', flag: '🇧🇷', group: 'C' },
  { id: 'morocco', name: 'Morocco', flag: '🇲🇦', group: 'C' },
  { id: 'haiti', name: 'Haiti', flag: '🇭🇹', group: 'C' },
  { id: 'scotland', name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', group: 'C' },
  // Group D
  { id: 'usa', name: 'United States', flag: '🇺🇸', group: 'D' },
  { id: 'paraguay', name: 'Paraguay', flag: '🇵🇾', group: 'D' },
  { id: 'australia', name: 'Australia', flag: '🇦🇺', group: 'D' },
  { id: 'turkey', name: 'Turkey', flag: '🇹🇷', group: 'D' },
  // Group E
  { id: 'germany', name: 'Germany', flag: '🇩🇪', group: 'E' },
  { id: 'curacao', name: 'Curaçao', flag: '🇨🇼', group: 'E' },
  { id: 'ivory-coast', name: 'Ivory Coast', flag: '🇨🇮', group: 'E' },
  { id: 'ecuador', name: 'Ecuador', flag: '🇪🇨', group: 'E' },
  // Group F
  { id: 'netherlands', name: 'Netherlands', flag: '🇳🇱', group: 'F' },
  { id: 'japan', name: 'Japan', flag: '🇯🇵', group: 'F' },
  { id: 'sweden', name: 'Sweden', flag: '🇸🇪', group: 'F' },
  { id: 'tunisia', name: 'Tunisia', flag: '🇹🇳', group: 'F' },
  // Group G
  { id: 'belgium', name: 'Belgium', flag: '🇧🇪', group: 'G' },
  { id: 'egypt', name: 'Egypt', flag: '🇪🇬', group: 'G' },
  { id: 'iran', name: 'Iran', flag: '🇮🇷', group: 'G' },
  { id: 'new-zealand', name: 'New Zealand', flag: '🇳🇿', group: 'G' },
  // Group H
  { id: 'spain', name: 'Spain', flag: '🇪🇸', group: 'H' },
  { id: 'cape-verde', name: 'Cape Verde', flag: '🇨🇻', group: 'H' },
  { id: 'saudi-arabia', name: 'Saudi Arabia', flag: '🇸🇦', group: 'H' },
  { id: 'uruguay', name: 'Uruguay', flag: '🇺🇾', group: 'H' },
  // Group I
  { id: 'france', name: 'France', flag: '🇫🇷', group: 'I' },
  { id: 'senegal', name: 'Senegal', flag: '🇸🇳', group: 'I' },
  { id: 'iraq', name: 'Iraq', flag: '🇮🇶', group: 'I' },
  { id: 'norway', name: 'Norway', flag: '🇳🇴', group: 'I' },
  // Group J
  { id: 'argentina', name: 'Argentina', flag: '🇦🇷', group: 'J' },
  { id: 'algeria', name: 'Algeria', flag: '🇩🇿', group: 'J' },
  { id: 'austria', name: 'Austria', flag: '🇦🇹', group: 'J' },
  { id: 'jordan', name: 'Jordan', flag: '🇯🇴', group: 'J' },
  // Group K
  { id: 'portugal', name: 'Portugal', flag: '🇵🇹', group: 'K' },
  { id: 'dr-congo', name: 'DR Congo', flag: '🇨🇩', group: 'K' },
  { id: 'uzbekistan', name: 'Uzbekistan', flag: '🇺🇿', group: 'K' },
  { id: 'colombia', name: 'Colombia', flag: '🇨🇴', group: 'K' },
  // Group L
  { id: 'england', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'L' },
  { id: 'croatia', name: 'Croatia', flag: '🇭🇷', group: 'L' },
  { id: 'ghana', name: 'Ghana', flag: '🇬🇭', group: 'L' },
  { id: 'panama', name: 'Panama', flag: '🇵🇦', group: 'L' },
];

export const TEAM_MAP: Record<string, Team> = Object.fromEntries(
  ALL_TEAMS.map(t => [t.id, t])
);

export const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export function createInitialGroups(): Record<string, Group> {
  const groups: Record<string, Group> = {};
  for (const letter of GROUP_LETTERS) {
    const teams = ALL_TEAMS.filter(t => t.group === letter);
    groups[letter] = {
      id: letter,
      teams,
      rankings: teams.map(t => t.id),
      completed: false,
    };
  }
  return groups;
}
