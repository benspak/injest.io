import pool from '../config/database.js';

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

export class TaskModel {
  static async create(input: CreateTaskInput): Promise<Task> {
    const result = await pool.query(
      `INSERT INTO tasks (item_id, title, description, status, due_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.item_id,
        input.title ?? null,
        input.description ?? null,
        input.status ?? 'pending',
        input.due_date ?? null,
      ]
    );

    return result.rows[0];
  }

  static async findById(id: string): Promise<Task | null> {
    const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async findByItemId(itemId: string): Promise<Task | null> {
    const result = await pool.query('SELECT * FROM tasks WHERE item_id = $1', [itemId]);
    return result.rows[0] || null;
  }

  static async findByOwner(ownerId: string, status?: TaskStatus): Promise<Task[]> {
    let query = `
      SELECT t.*
      FROM tasks t
      JOIN items i ON t.item_id = i.id
      WHERE i.owner_id = $1
    `;

    const params: (string | TaskStatus)[] = [ownerId];

    if (status) {
      query += ' AND t.status = $2';
      params.push(status);
    }

    query += ' ORDER BY t.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  }

  static async update(id: string, updates: UpdateTaskInput): Promise<Task> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.title !== undefined) {
      fields.push(`title = $${paramCount++}`);
      values.push(updates.title ?? null);
    }

    if (updates.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(updates.description ?? null);
    }

    if (updates.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(updates.status);
    }

    if (updates.due_date !== undefined) {
      fields.push(`due_date = $${paramCount++}`);
      values.push(updates.due_date ?? null);
    }

    if (fields.length === 0) {
      const existing = await this.findById(id);
      if (!existing) {
        throw new Error('Task not found');
      }
      return existing;
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows[0];
  }

  static async delete(id: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}
