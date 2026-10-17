import { BrowserRouter, Route, Routes } from 'react-router';
import { FeedbackProvider } from './feedback';
import { EditorsProvider } from './editors';
import { PomodoroProvider } from './pomodoro';
import { Layout } from './Layout';
import { TodayPage } from '../pages/TodayPage';
import { InboxPage } from '../pages/InboxPage';
import { TasksPage } from '../pages/TasksPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { ProjectDetailPage } from '../pages/ProjectDetailPage';
import { GoalsPage } from '../pages/GoalsPage';
import { HabitsPage } from '../pages/HabitsPage';
import { NotesPage } from '../pages/NotesPage';
import { ReviewPage } from '../pages/ReviewPage';
import { SettingsPage } from '../pages/SettingsPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { FocusPage } from '../pages/FocusPage';

export function App() {
  return (
    <BrowserRouter>
      <FeedbackProvider>
        <PomodoroProvider>
          <EditorsProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<TodayPage />} />
                <Route path="inbox" element={<InboxPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="projects/:id" element={<ProjectDetailPage />} />
                <Route path="goals" element={<GoalsPage />} />
                <Route path="habits" element={<HabitsPage />} />
                <Route path="notes" element={<NotesPage />} />
                <Route path="focus" element={<FocusPage />} />
                <Route path="review" element={<ReviewPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </EditorsProvider>
        </PomodoroProvider>
      </FeedbackProvider>
    </BrowserRouter>
  );
}
