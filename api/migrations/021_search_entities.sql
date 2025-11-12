-- Generalized search document + embedding support
CREATE TABLE IF NOT EXISTS search_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    title TEXT,
    content TEXT,
    summary TEXT,
    tags TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_search_documents_owner_id
    ON search_documents (owner_id);

CREATE INDEX IF NOT EXISTS idx_search_documents_entity_type
    ON search_documents (entity_type);

CREATE INDEX IF NOT EXISTS idx_search_documents_tags
    ON search_documents USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_search_documents_metadata
    ON search_documents USING GIN (metadata);

CREATE TABLE IF NOT EXISTS search_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES search_documents(id) ON DELETE CASCADE,
    embedding VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id)
);

CREATE INDEX IF NOT EXISTS idx_search_embeddings_document_id
    ON search_embeddings (document_id);

CREATE INDEX IF NOT EXISTS idx_search_embeddings_vector_hnsw
    ON search_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

DROP TRIGGER IF EXISTS update_search_documents_updated_at ON search_documents;
CREATE TRIGGER update_search_documents_updated_at
    BEFORE UPDATE ON search_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
