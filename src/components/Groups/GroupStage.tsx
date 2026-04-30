import { useApp } from '../../context/AppContext';
import { GroupCard } from './GroupCard';
import { GROUP_LETTERS } from '../../data/teams';

export function GroupStage() {
  const { state, goToThirdPlace, isLocked, isReadOnly } = useApp();

  return (
    <div className="group-stage">
      <div className="stage-header">
        <h2 className="stage-title">Group Stage</h2>
        <p className="stage-desc">
          {isLocked
            ? 'Tournament has started. No more changes are allowed. Have fun!'
            : "Drag teams to rank them 1–4 in each group. Proceed whenever you're ready."}
        </p>
      </div>

      <div className="groups-grid">
        {GROUP_LETTERS.map(letter => (
          <GroupCard key={letter} group={state.groups[letter]} />
        ))}
      </div>

      {!isReadOnly && (
        <div className="stage-footer">
          <button className="btn btn-gold btn-lg" onClick={goToThirdPlace}>
            Proceed to Third Place Selection →
          </button>
        </div>
      )}
    </div>
  );
}
