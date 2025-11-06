-- Migration to purge all LinkedIn connection items
-- This removes all items with source = 'linkedin-connection' from the database
-- Related embeddings and tasks will be automatically deleted via CASCADE

-- Count items to be deleted (for logging/reference)
-- SELECT COUNT(*) FROM items WHERE source = 'linkedin-connection';

-- Delete all LinkedIn connection items
-- This will cascade to related embeddings and tasks due to foreign key constraints
DELETE FROM items WHERE source = 'linkedin-connection';

-- Note: The following tables are automatically cleaned up via CASCADE:
-- - embeddings (via embedding_id foreign key with ON DELETE CASCADE)
-- - tasks (via item_id foreign key with ON DELETE CASCADE)

-- Verify deletion (optional - uncomment to check)
-- SELECT COUNT(*) FROM items WHERE source = 'linkedin-connection';
-- Should return 0
