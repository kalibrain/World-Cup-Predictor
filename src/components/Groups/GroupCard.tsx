import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Group } from '../../types';
import { TEAM_MAP } from '../../data/teams';
import { useApp } from '../../context/AppContext';
import { FlagIcon } from '../FlagIcon';

interface SortableTeamProps {
  id: string;
  rank: number;
  isReadOnly: boolean;
}

function SortableTeam({ id, rank, isReadOnly }: SortableTeamProps) {
  const team = TEAM_MAP[id];
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isReadOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`team-row ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...(isReadOnly ? {} : listeners)}
    >
      <div className="team-rank">{rank}</div>
      <div className="team-drag-handle" aria-hidden="true">
        {!isReadOnly && <span className="drag-icon">⠿</span>}
      </div>
      <div className="team-flag">{team && <FlagIcon countryCode={team.countryCode} teamName={team.name} size={24} />}</div>
      <div className="team-name">{team?.name}</div>
    </div>
  );
}

interface GroupCardProps {
  group: Group;
}

export function GroupCard({ group }: GroupCardProps) {
  const { updateGroupRankings, isReadOnly } = useApp();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = group.rankings.indexOf(active.id as string);
      const newIndex = group.rankings.indexOf(over.id as string);
      const newRankings = arrayMove(group.rankings, oldIndex, newIndex);
      updateGroupRankings(group.id, newRankings);
    }
  };

  return (
    <div className={`group-card ${group.completed ? 'completed' : ''}`}>
      <div className="group-card-header">
        <div className="group-letter">Group {group.id}</div>
      </div>
      <div className="group-rank-labels">
        <span className="rank-label-text">Drag to rank</span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={group.rankings} strategy={verticalListSortingStrategy}>
          {group.rankings.map((teamId, idx) => (
            <SortableTeam
              key={teamId}
              id={teamId}
              rank={idx + 1}
              isReadOnly={isReadOnly}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
