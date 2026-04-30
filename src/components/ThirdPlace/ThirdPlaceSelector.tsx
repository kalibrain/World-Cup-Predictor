import { useApp } from '../../context/AppContext';
import { TEAM_MAP, GROUP_LETTERS } from '../../data/teams';
import { assignThirdPlaceTeams } from '../../utils/thirdPlaceAssignment';
import { FlagIcon } from '../FlagIcon';

export function ThirdPlaceSelector() {
  const { state, toggleThirdPlace, confirmThirdPlace, goBackToGroups, isLocked, isReadOnly } = useApp();

  const selectedCount = state.selectedThirdPlace.length;
  const canProceed = selectedCount === 8;

  // Check if assignment is possible with current selections
  const assignmentValid = canProceed ? assignThirdPlaceTeams(state.selectedThirdPlace) !== null : true;

  return (
    <div className="third-place-screen">
      <div className="stage-header">
        <h2 className="stage-title">Third Place Teams</h2>
        <p className="stage-desc">
          {isLocked ? (
            'Tournament has started. No more changes are allowed. Have fun!'
          ) : (
            <>
              Select exactly <strong>8</strong> third-place teams to qualify for the Round of 32.
              These are the teams that finished 3rd in their respective groups.
            </>
          )}
        </p>
        <div className={`selection-counter ${selectedCount === 8 ? 'complete' : ''}`}>
          <span className="counter-num">{selectedCount}</span>
          <span className="counter-sep">/</span>
          <span className="counter-max">8</span>
          <span className="counter-label"> selected</span>
        </div>
      </div>

      <div className="third-place-grid">
        {GROUP_LETTERS.map(letter => {
          const group = state.groups[letter];
          const thirdPlaceTeamId = group.rankings[2];
          const team = TEAM_MAP[thirdPlaceTeamId];
          if (!team) return null;

          const isSelected = state.selectedThirdPlace.includes(letter);
          const isDisabled = !isSelected && selectedCount >= 8;

          return (
            <button
              key={letter}
              className={`third-place-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled-card' : ''}`}
              onClick={() => !isReadOnly && !isDisabled && toggleThirdPlace(letter)}
              disabled={isReadOnly}
            >
              <div className="third-group-badge">Group {letter}</div>
              <div className="third-team-flag"><FlagIcon countryCode={team.countryCode} teamName={team.name} size={32} /></div>
              <div className="third-team-name">{team.name}</div>
              {isSelected && <div className="third-check">✓</div>}
            </button>
          );
        })}
      </div>

      {!assignmentValid && canProceed && (
        <div className="assignment-error">
          ⚠ The selected combination of third-place teams cannot be validly assigned to the bracket slots.
          Please try a different selection.
        </div>
      )}

      {!isReadOnly && (
        <div className="stage-footer stage-footer-split">
          <button className="btn btn-outline" onClick={goBackToGroups}>
            ← Back to Groups
          </button>
          <button
            className={`btn btn-gold btn-lg ${(!canProceed || !assignmentValid) ? 'disabled' : ''}`}
            onClick={canProceed && assignmentValid ? confirmThirdPlace : undefined}
            disabled={!canProceed || !assignmentValid}
          >
            {canProceed ? 'Build Knockout Bracket →' : `Select ${8 - selectedCount} more`}
          </button>
        </div>
      )}
    </div>
  );
}
