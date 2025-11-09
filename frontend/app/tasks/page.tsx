'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { AvatarMenu } from '@/components/avatar-menu';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { TaskList } from '@/components/task-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient, Task, TaskStatus } from '@/lib/api';
import { auth } from '@/lib/auth';

type StatusFilter = TaskStatus;

const STATUS_FILTERS: Array<{ label: string; value: StatusFilter }> = [
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function TasksPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');

  const loadTasks = useCallback(async (filter: StatusFilter) => {
    setLoadingTasks(true);
    try {
      const result = await apiClient.getTasks(filter);
      setTasks(result);
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast.error('Unable to load tasks right now. Please try again.');
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await auth.restore();
      setAuthLoading(false);

      if (!auth.isAuthenticated()) {
        router.push('/login');
        return;
      }

      setAuthReady(true);
    };

    init();
  }, [router]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    loadTasks(statusFilter);
  }, [authReady, statusFilter, loadTasks]);

  const handleTaskChange = (updatedTask: Task) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === updatedTask.id
          ? { ...task, ...updatedTask, item: updatedTask.item ?? task.item }
          : task
      )
    );
  };

  const handleRefresh = () => {
    loadTasks(statusFilter);
  };

  if (authLoading) {
    return <div className="container mx-auto px-4 py-12">Loading...</div>;
  }

  if (!auth.isAuthenticated()) {
    return null;
  }

  const currentUser = auth.getUser();

  return (
    <div className="min-h-screen bg-gray-50">
      <AnnouncementBanner />
      <header className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 flex justify-between items-center max-w-full">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
              ← Back to Dashboard
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold">Tasks</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
            >
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <FeedbackDialog
              userEmail={currentUser?.email}
              buttonVariant="outline"
              buttonSize="sm"
              triggerClassName="text-xs sm:text-sm"
            />
            <AvatarMenu user={currentUser} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 max-w-4xl space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg sm:text-xl">Your Next Actions</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs sm:text-sm font-medium text-gray-700" htmlFor="task-status-filter">
                Status
              </label>
              <select
                id="task-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <TaskList tasks={tasks} loading={loadingTasks} onTaskChange={handleTaskChange} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
