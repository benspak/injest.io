-- Speed up nearest-neighbor lookups for semantic search by adding an HNSW index.
-- This index supports cosine distance queries (`<=>`) against the embeddings vector.
-- Safe to run multiple times thanks to IF NOT EXISTS.
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_hnsw
    ON embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
