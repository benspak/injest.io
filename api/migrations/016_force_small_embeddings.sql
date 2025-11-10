-- Ensure embeddings are stored using 1536-dimension vectors for text-embedding-3-small.
-- WARNING: This migration drops the existing embedding column, deleting all stored embeddings.
-- After running, re-run indexing to regenerate embeddings.

-- Drop dependent index before altering the column.
DROP INDEX IF EXISTS idx_embeddings_vector_hnsw;

-- Replace the embedding column with the correct dimension.
ALTER TABLE embeddings DROP COLUMN IF EXISTS embedding;
ALTER TABLE embeddings ADD COLUMN embedding vector(1536);

-- Recreate the HNSW index for faster similarity search.
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_hnsw
    ON embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
