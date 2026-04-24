import type { Team, Group } from '../types';

export const ALL_TEAMS: Team[] = [
  // Group A
  { id: 'mexico', name: 'Mexico', flag: '🇲🇽', countryCode: 'mx', group: 'A' },
  { id: 'south-africa', name: 'South Africa', flag: '🇿🇦', countryCode: 'za', group: 'A' },
  { id: 'south-korea', name: 'South Korea', flag: '🇰🇷', countryCode: 'kr', group: 'A' },
  { id: 'czech-republic', name: 'Czech Republic', flag: '🇨🇿', countryCode: 'cz', group: 'A' },
  // Group B
  { id: 'canada', name: 'Canada', flag: '🇨🇦', countryCode: 'ca', group: 'B' },
  { id: 'bosnia', name: 'Bosnia and Herzegovina', flag: '🇧🇦', countryCode: 'ba', group: 'B' },
  { id: 'qatar', name: 'Qatar', flag: '🇶🇦', countryCode: 'qa', group: 'B' },
  { id: 'switzerland', name: 'Switzerland', flag: '🇨🇭', countryCode: 'ch', group: 'B' },
  // Group C
  { id: 'brazil', name: 'Brazil', flag: '🇧🇷', countryCode: 'br', group: 'C' },
  { id: 'morocco', name: 'Morocco', flag: '🇲🇦', countryCode: 'ma', group: 'C' },
  { id: 'haiti', name: 'Haiti', flag: '🇭🇹', countryCode: 'ht', group: 'C' },
  { id: 'scotland', name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', countryCode: 'gb-sct', group: 'C' },
  // Group D
  { id: 'usa', name: 'United States', flag: '🇺🇸', countryCode: 'us', group: 'D' },
  { id: 'paraguay', name: 'Paraguay', flag: '🇵🇾', countryCode: 'py', group: 'D' },
  { id: 'australia', name: 'Australia', flag: '🇦🇺', countryCode: 'au', group: 'D' },
  { id: 'turkey', name: 'Turkey', flag: '🇹🇷', countryCode: 'tr', group: 'D' },
  // Group E
  { id: 'germany', name: 'Germany', flag: '🇩🇪', countryCode: 'de', group: 'E' },
  { id: 'curacao', name: 'Curaçao', flag: '🇨🇼', countryCode: 'cw', group: 'E' },
  { id: 'ivory-coast', name: 'Ivory Coast', flag: '🇨🇮', countryCode: 'ci', group: 'E' },
  { id: 'ecuador', name: 'Ecuador', flag: '🇪🇨', countryCode: 'ec', group: 'E' },
  // Group F
  { id: 'netherlands', name: 'Netherlands', flag: '🇳🇱', countryCode: 'nl', group: 'F' },
  { id: 'japan', name: 'Japan', flag: '🇯🇵', countryCode: 'jp', group: 'F' },
  { id: 'sweden', name: 'Sweden', flag: '🇸🇪', countryCode: 'se', group: 'F' },
  { id: 'tunisia', name: 'Tunisia', flag: '🇹🇳', countryCode: 'tn', group: 'F' },
  // Group G
  { id: 'belgium', name: 'Belgium', flag: '🇧🇪', countryCode: 'be', group: 'G' },
  { id: 'egypt', name: 'Egypt', flag: '🇪🇬', countryCode: 'eg', group: 'G' },
  { id: 'iran', name: 'Iran', flag: '🇮🇷', countryCode: 'ir', group: 'G' },
  { id: 'new-zealand', name: 'New Zealand', flag: '🇳🇿', countryCode: 'nz', group: 'G' },
  // Group H
  { id: 'spain', name: 'Spain', flag: '🇪🇸', countryCode: 'es', group: 'H' },
  { id: 'cape-verde', name: 'Cape Verde', flag: '🇨🇻', countryCode: 'cv', group: 'H' },
  { id: 'saudi-arabia', name: 'Saudi Arabia', flag: '🇸🇦', countryCode: 'sa', group: 'H' },
  { id: 'uruguay', name: 'Uruguay', flag: '🇺🇾', countryCode: 'uy', group: 'H' },
  // Group I
  { id: 'france', name: 'France', flag: '🇫🇷', countryCode: 'fr', group: 'I' },
  { id: 'senegal', name: 'Senegal', flag: '🇸🇳', countryCode: 'sn', group: 'I' },
  { id: 'iraq', name: 'Iraq', flag: '🇮🇶', countryCode: 'iq', group: 'I' },
  { id: 'norway', name: 'Norway', flag: '🇳🇴', countryCode: 'no', group: 'I' },
  // Group J
  { id: 'argentina', name: 'Argentina', flag: '🇦🇷', countryCode: 'ar', group: 'J' },
  { id: 'algeria', name: 'Algeria', flag: '🇩🇿', countryCode: 'dz', group: 'J' },
  { id: 'austria', name: 'Austria', flag: '🇦🇹', countryCode: 'at', group: 'J' },
  { id: 'jordan', name: 'Jordan', flag: '🇯🇴', countryCode: 'jo', group: 'J' },
  // Group K
  { id: 'portugal', name: 'Portugal', flag: '🇵🇹', countryCode: 'pt', group: 'K' },
  { id: 'dr-congo', name: 'DR Congo', flag: '🇨🇩', countryCode: 'cd', group: 'K' },
  { id: 'uzbekistan', name: 'Uzbekistan', flag: '🇺🇿', countryCode: 'uz', group: 'K' },
  { id: 'colombia', name: 'Colombia', flag: '🇨🇴', countryCode: 'co', group: 'K' },
  // Group L
  { id: 'england', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', countryCode: 'gb-eng', group: 'L' },
  { id: 'croatia', name: 'Croatia', flag: '🇭🇷', countryCode: 'hr', group: 'L' },
  { id: 'ghana', name: 'Ghana', flag: '🇬🇭', countryCode: 'gh', group: 'L' },
  { id: 'panama', name: 'Panama', flag: '🇵🇦', countryCode: 'pa', group: 'L' },
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
