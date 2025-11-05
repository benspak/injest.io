import pool from '../config/database.js';

export interface Embedding {
  id: string;
  item_id: string;
  embedding: number[];
  created_at: Date;
}

export class EmbeddingModel {
  static async create(itemId: string, embedding: number[]): Promise<Embedding> {
    // Convert array to pgvector format
    const result = await pool.query(
      'INSERT INTO embeddings (item_id, embedding) VALUES ($1, $2::vector) RETURNING *',
      [itemId, `[${embedding.join(',')}]`]
    );
    return result.rows[0];
  }

  static async findByItemId(itemId: string): Promise<Embedding | null> {
    const result = await pool.query(
      'SELECT * FROM embeddings WHERE item_id = $1',
      [itemId]
    );
    return result.rows[0] || null;
  }

  static async findSimilar(queryEmbedding: number[], limit: number = 10): Promise<Embedding[]> {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    const result = await pool.query(
      `SELECT *, 1 - (embedding <=> $1::vector) as similarity
       FROM embeddings
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [embeddingStr, limit]
    );
    return result.rows;
  }

  static async deleteByItemId(itemId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM embeddings WHERE item_id = $1',
      [itemId]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
}
