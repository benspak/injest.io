export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export interface Task {
    id: string;
    item_id: string;
    title: string | null;
    description: string | null;
    status: TaskStatus;
    due_date: Date | string | null;
    created_at: Date | string;
    updated_at: Date | string;
}
export interface CreateTaskInput {
    item_id: string;
    title?: string | null;
    description?: string | null;
    status?: TaskStatus;
    due_date?: Date | string | null;
}
export interface UpdateTaskInput {
    title?: string | null;
    description?: string | null;
    status?: TaskStatus;
    due_date?: Date | string | null;
}
export declare class TaskModel {
    static create(input: CreateTaskInput): Promise<Task>;
    static findById(id: string): Promise<Task | null>;
    static findByItemId(itemId: string): Promise<Task | null>;
    static findByOwner(ownerId: string, status?: TaskStatus): Promise<Task[]>;
    static update(id: string, updates: UpdateTaskInput): Promise<Task>;
    static delete(id: string): Promise<boolean>;
}
//# sourceMappingURL=Task.d.ts.map