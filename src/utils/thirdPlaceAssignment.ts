import { THIRD_PLACE_SLOT_ELIGIBILITY } from '../data/bracket';

const THIRD_PLACE_SLOTS = ['M1', 'M2', 'M7', 'M8', 'M11', 'M12', 'M15', 'M16'];

/**
 * Given 8 group letters (the groups whose 3rd place teams were selected),
 * find a valid assignment of groups to match slots using backtracking.
 * Returns a map of matchId -> groupLetter, or null if no valid assignment exists.
 */
export function assignThirdPlaceTeams(selectedGroups: string[]): Record<string, string> | null {
  if (selectedGroups.length !== 8) return null;

  const assignment: Record<string, string> = {};
  const usedGroups = new Set<string>();

  function backtrack(slotIndex: number): boolean {
    if (slotIndex === THIRD_PLACE_SLOTS.length) {
      return true; // all slots assigned
    }

    const slotId = THIRD_PLACE_SLOTS[slotIndex];
    const eligible = THIRD_PLACE_SLOT_ELIGIBILITY[slotId];

    for (const group of selectedGroups) {
      if (usedGroups.has(group)) continue;
      if (!eligible.includes(group)) continue;

      assignment[slotId] = group;
      usedGroups.add(group);

      if (backtrack(slotIndex + 1)) {
        return true;
      }

      delete assignment[slotId];
      usedGroups.delete(group);
    }

    return false;
  }

  const success = backtrack(0);
  return success ? assignment : null;
}
