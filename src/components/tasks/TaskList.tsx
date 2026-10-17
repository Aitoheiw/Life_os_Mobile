import type { Project, Task } from '../../models';
import { TaskItem } from './TaskItem';

export function TaskList({ tasks, projectById, day, showProject = true }: { tasks: Task[]; projectById: Map<string, Project>; day: string; showProject?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {tasks.map((t) => (
        <TaskItem key={t.id} task={t} project={t.projectId ? projectById.get(t.projectId) : undefined} day={day} showProject={showProject} />
      ))}
    </ul>
  );
}
