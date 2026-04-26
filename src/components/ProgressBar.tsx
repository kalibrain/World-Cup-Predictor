import type { AppStep } from '../types';

const STEPS: { id: AppStep; label: string }[] = [
  { id: 'intro', label: 'Start' },
  { id: 'groups', label: 'Group Stage' },
  { id: 'third-place', label: '3rd Place' },
  { id: 'bracket', label: 'Knockout' },
];

interface Props {
  currentStep: AppStep;
  furthestStep: AppStep;
  onStepClick?: (step: AppStep) => void;
}

export function ProgressBar({ currentStep, furthestStep, onStepClick }: Props) {
  const currentIndex = STEPS.findIndex(s => s.id === currentStep);
  const furthestIndex = STEPS.findIndex(s => s.id === furthestStep);

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-inner">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isActive = idx === currentIndex;
          const isReachable = idx <= furthestIndex && idx > 0; // can't go back to intro
          const isClickable = isReachable && !isActive && !!onStepClick;
          return (
            <div key={step.id} style={{ display: 'contents' }}>
              <div
                className={`progress-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isClickable ? 'clickable' : ''} ${!isReachable ? 'disabled' : ''}`}
                onClick={isClickable ? () => onStepClick(step.id) : undefined}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onStepClick(step.id); } : undefined}
              >
                <div className="progress-dot">
                  {isCompleted ? '✓' : idx + 1}
                </div>
                <div className="progress-label">{step.label}</div>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`progress-line ${isCompleted ? 'completed' : ''}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
