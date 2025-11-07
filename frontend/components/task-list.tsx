'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, Task, TaskStatus } from '@/lib/api';

interface TaskListProps {
  tasks: Task[];
  loading?: boolean;
  onTaskChange?: (task: Task) => void;
}

const STATUS_OPTIONS: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

export function TaskList({ tasks, loading, onTaskChange }: TaskListProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const openEditor = (task: Task) => {
    setSelectedTask(task);
    setTitle(task.title ?? task.item?.title ?? '');
    setDescription(task.description ?? task.item?.description ?? '');
    setStatus(task.status);
    setDueDate(task.due_date ? formatDateInput(task.due_date) : '');
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setSelectedTask(null);
    setSaving(false);
  };

  const handleSave = async () => {
    if (!selectedTask) return;

    setSaving(true);
    try {
      const payload: {
        title?: string;
        description?: string;
        status?: TaskStatus;
        due_date?: string | null;
      } = {
        title,
        description,
        status,
      };

      payload.due_date = dueDate ? toIsoEndOfDay(dueDate) : null;

      const updated = await apiClient.updateTask(selectedTask.id, payload);

      onTaskChange?.({ ...updated, item: selectedTask.item });
      toast.success('Task updated');
      closeEditor();
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast.error(error?.message || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;

      if (aDue === bDue) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      return aDue - bDue;
    });
  }, [tasks]);

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="rounded-md border border-dashed border-gray-200 bg-white p-4 text-sm text-muted-foreground">
          Loading tasks...
        </div>
      ) : sortedTasks.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-200 bg-white p-4 text-sm text-muted-foreground">
          No tasks yet. Turn an item into a task to see it here.
        </div>
      ) : (
        sortedTasks.map((task) => {
          const imageAttachments = Array.isArray(task.item?.attachments)
            ? (task.item.attachments as Array<{ filename: string; originalname: string; mimetype?: string }>)
                .filter((file) => apiClient.isImageMimetype(file.mimetype))
            : [];

          return (
            <div key={task.id} className="space-y-3 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-base font-semibold">
                    {task.title || task.item?.title || 'Untitled task'}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    Status: {task.status.replace('_', ' ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-500">Due</p>
                  <p className="text-sm font-semibold">
                    {task.due_date ? formatDisplayDate(task.due_date) : 'No due date'}
                  </p>
                </div>
              </div>

              {imageAttachments.length > 0 && task.item?.id && (
                <div className="overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                  <img
                    src={apiClient.getFileUrl(task.item.id, imageAttachments[0].filename, true)}
                    alt={imageAttachments[0].originalname}
                    className="h-auto w-full max-h-60 object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {(task.item?.url || task.item?.id) && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {task.item?.url && (
                    <a
                      href={task.item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:underline"
                    >
                      Open source link
                      <svg
                        className="ml-1 h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4.5 19.5l15-15M9 4.5h10.5V15"
                        />
                      </svg>
                    </a>
                  )}

                  {task.item?.id && (
                    <Link
                      href={`/items/${task.item.id}`}
                      className="inline-flex items-center text-blue-600 hover:underline"
                    >
                      View original item
                      <svg
                        className="ml-1 h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4h16v16H4z"
                        />
                      </svg>
                    </Link>
                  )}
                </div>
              )}

              {(task.item?.description || task.description) && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {task.description || task.item?.description}
                </p>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => openEditor(task)}
              >
                Edit task
              </Button>
            </div>
          );
        })
      )}

      <Dialog open={editorOpen} onOpenChange={(open) => (!open ? closeEditor() : setEditorOpen(open))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update task details, due date, and status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What needs to be done?"
                className="min-h-[120px]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Due date</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeEditor} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDisplayDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateInput(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function toIsoEndOfDay(dateString: string): string | null {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;
  const utcDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
  return utcDate.toISOString();
}
