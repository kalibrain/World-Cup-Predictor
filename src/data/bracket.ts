import type { Match } from '../types';

// R32 match definitions with dates
export const R32_MATCH_DATES: Record<string, string> = {
  M1: 'Jun 29',
  M2: 'Jun 30',
  M3: 'Jun 28',
  M4: 'Jun 29',
  M5: 'Jul 2',
  M6: 'Jul 2',
  M7: 'Jul 1',
  M8: 'Jul 1',
  M9: 'Jun 29',
  M10: 'Jun 30',
  M11: 'Jun 30',
  M12: 'Jul 1',
  M13: 'Jul 3',
  M14: 'Jul 3',
  M15: 'Jul 2',
  M16: 'Jul 3',
};

// Third-place slot eligibility: which groups' 3rd place teams can fill each slot
export const THIRD_PLACE_SLOT_ELIGIBILITY: Record<string, string[]> = {
  M1: ['A', 'B', 'C', 'D', 'F'],
  M2: ['C', 'D', 'F', 'G', 'H'],
  M7: ['B', 'E', 'F', 'I', 'J'],
  M8: ['A', 'E', 'H', 'I', 'J'],
  M11: ['C', 'E', 'F', 'H', 'I'],
  M12: ['E', 'H', 'I', 'J', 'K'],
  M15: ['E', 'F', 'G', 'I', 'J'],
  M16: ['D', 'E', 'I', 'J', 'L'],
};

// Bracket tree: which two matches feed into each higher round match
export const BRACKET_FEED: Record<string, [string, string]> = {
  R16_1: ['M1', 'M2'],
  R16_2: ['M3', 'M4'],
  R16_3: ['M5', 'M6'],
  R16_4: ['M7', 'M8'],
  R16_5: ['M9', 'M10'],
  R16_6: ['M11', 'M12'],
  R16_7: ['M13', 'M14'],
  R16_8: ['M15', 'M16'],
  QF1: ['R16_1', 'R16_2'],
  QF2: ['R16_3', 'R16_4'],
  QF3: ['R16_5', 'R16_6'],
  QF4: ['R16_7', 'R16_8'],
  SF1: ['QF1', 'QF2'],
  SF2: ['QF3', 'QF4'],
  FINAL: ['SF1', 'SF2'],
};

export function createInitialMatches(): Record<string, Match> {
  const matches: Record<string, Match> = {};

  // R32 matches
  const r32Ids = ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12','M13','M14','M15','M16'];
  for (const id of r32Ids) {
    matches[id] = {
      id,
      round: 'R32',
      date: R32_MATCH_DATES[id],
      slot1: { teamId: null },
      slot2: { teamId: null },
      winnerId: null,
    };
  }

  // R16 matches
  for (let i = 1; i <= 8; i++) {
    const id = `R16_${i}`;
    matches[id] = {
      id,
      round: 'R16',
      slot1: { teamId: null },
      slot2: { teamId: null },
      winnerId: null,
    };
  }

  // QF matches
  for (let i = 1; i <= 4; i++) {
    const id = `QF${i}`;
    matches[id] = {
      id,
      round: 'QF',
      slot1: { teamId: null },
      slot2: { teamId: null },
      winnerId: null,
    };
  }

  // SF matches
  for (let i = 1; i <= 2; i++) {
    const id = `SF${i}`;
    matches[id] = {
      id,
      round: 'SF',
      slot1: { teamId: null },
      slot2: { teamId: null },
      winnerId: null,
    };
  }

  // Final
  matches['FINAL'] = {
    id: 'FINAL',
    round: 'FINAL',
    slot1: { teamId: null },
    slot2: { teamId: null },
    winnerId: null,
  };

  // 3rd place playoff
  matches['3PO'] = {
    id: '3PO',
    round: '3PO',
    slot1: { teamId: null },
    slot2: { teamId: null },
    winnerId: null,
  };

  return matches;
}
