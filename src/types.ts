export interface Team {
  id: string;
  name: string;
  flag: string;
  countryCode: string;
  group: string;
}

export interface Group {
  id: string; // 'A' through 'L'
  teams: Team[];
  rankings: string[]; // team ids in ranked order (index 0 = rank 1)
  completed: boolean;
}

export type AppStep = 'intro' | 'groups' | 'third-place' | 'bracket';

export interface MatchSlot {
  teamId: string | null; // null means TBD
  source?: string; // description of where this team comes from
}

export interface Match {
  id: string; // e.g. 'M1', 'R16_1', 'QF1', 'SF1', 'FINAL', '3PO'
  round: 'R32' | 'R16' | 'QF' | 'SF' | 'FINAL' | '3PO';
  date?: string;
  slot1: MatchSlot;
  slot2: MatchSlot;
  winnerId: string | null;
}

export interface BracketState {
  matches: Record<string, Match>;
  thirdPlaceAssignment: Record<string, string>; // matchId -> teamId
}

export interface AppState {
  step: AppStep;
  furthestStep: AppStep;
  bracketName: string;
  groups: Record<string, Group>;
  selectedThirdPlace: string[]; // group ids of selected 3rd place teams (exactly 8)
  thirdPlaceAssignment: Record<string, string>; // matchId -> teamId
  matches: Record<string, Match>;
}
