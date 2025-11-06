-- Migration to support text-embedding-3-small (1536 dimensions)
-- This is OPTIONAL - only run if you want to use the cheaper embedding model
-- WARNING: This will require regenerating all existing embeddings
--
-- To use this migration:
-- 1. Backup your database
-- 2. Run this migration
-- 3. Regenerate all embeddings (they will use the new smaller model)

-- Change embedding dimension from 3072 to 1536
-- Note: This requires dropping and recreating the column, which will delete all existing embeddings
-- You'll need to regenerate embeddings after this migration

-- Step 1: Drop the old column
ALTER TABLE embeddings DROP COLUMN IF EXISTS embedding;

-- Step 2: Add the new column with smaller dimension
ALTER TABLE embeddings ADD COLUMN embedding vector(1536);

-- Step 3: Recreate the index (if it exists)
-- Note: The original schema didn't create a vector index, but if you have one, recreate it:
-- DROP INDEX IF EXISTS idx_embeddings_vector;
-- CREATE INDEX idx_embeddings_vector ON embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
