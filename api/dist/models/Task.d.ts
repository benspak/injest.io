export interface Task {
    id: string;
    item_id: string;
    title?: string;
    description?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    due_date?: Date;
    created_at: Date;
    updated_at: Date;
}
export interface CreateTaskInput {
    item_id: string;
    title?: string;
    description?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    due_date?: Date;
}
export declare class TaskModel {
    static create(input: CreateTaskInput): Promise<Task>;
    static findById(id: string): Promise<Task | null>;
    static findByItemId(itemId: string): Promise<Task | null>;
    static findByOwner(ownerId: string, status?: string): Promise<Task[]>;
    static update(id: string, updates: Partial<Task>): Promise<Task>;
    static delete(id: string): Promise<boolean>;
}
//# sourceMappingURL=Task.d.ts.map