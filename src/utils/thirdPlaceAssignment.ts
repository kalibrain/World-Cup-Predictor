import { THIRD_PLACE_SLOT_ELIGIBILITY } from '../data/bracket';
import thirdPlaceTableCsv from '../../2026-third-place-table.csv?raw';

const GROUP_COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const ASSIGNMENT_COLUMNS = [
  { csvIndex: 13, matchId: 'M11' }, // 1A vs third-place team
  { csvIndex: 14, matchId: 'M15' }, // 1B vs third-place team
  { csvIndex: 15, matchId: 'M7' },  // 1D vs third-place team
  { csvIndex: 16, matchId: 'M1' },  // 1E vs third-place team
  { csvIndex: 17, matchId: 'M8' },  // 1G vs third-place team
  { csvIndex: 18, matchId: 'M2' },  // 1I vs third-place team
  { csvIndex: 19, matchId: 'M16' }, // 1K vs third-place team
  { csvIndex: 20, matchId: 'M12' }, // 1L vs third-place team
];

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows;
}

function buildOfficialAssignmentMap(): Record<string, Record<string, string>> {
  const rows = parseCsv(thirdPlaceTableCsv);
  const assignmentsByGroupKey: Record<string, Record<string, string>> = {};

  for (const row of rows.slice(1)) {
    const selectedGroups = GROUP_COLUMNS.filter((_, index) => row[index + 1]);
    if (selectedGroups.length !== 8) continue;

    const assignment: Record<string, string> = {};
    for (const { csvIndex, matchId } of ASSIGNMENT_COLUMNS) {
      const groupId = row[csvIndex]?.replace(/^3/, '') ?? '';
      if (!THIRD_PLACE_SLOT_ELIGIBILITY[matchId]?.includes(groupId)) {
        throw new Error(`Invalid third-place assignment ${row[csvIndex]} for ${matchId}`);
      }
      assignment[matchId] = groupId;
    }

    assignmentsByGroupKey[selectedGroups.join('')] = assignment;
  }

  return assignmentsByGroupKey;
}

const OFFICIAL_ASSIGNMENTS = buildOfficialAssignmentMap();

/**
 * Given 8 group letters (the groups whose 3rd place teams were selected),
 * return FIFA's official assignment of groups to match slots.
 * Returns a map of matchId -> groupLetter, or null if no valid assignment exists.
 */
export function assignThirdPlaceTeams(selectedGroups: string[]): Record<string, string> | null {
  if (selectedGroups.length !== 8) return null;

  const uniqueGroups = new Set(selectedGroups);
  if (uniqueGroups.size !== 8) return null;

  const groupKey = [...uniqueGroups].sort().join('');
  const assignment = OFFICIAL_ASSIGNMENTS[groupKey];
  return assignment ? { ...assignment } : null;
}
