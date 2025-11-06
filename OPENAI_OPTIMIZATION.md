# OpenAI API Cost Optimization Analysis

## Current Usage Analysis

### Models Being Used:
1. **Embeddings**: `text-embedding-3-large` (3072 dimensions) - *Default*
   - Used for: Item indexing, search similarity
   - Cost: ~$0.13 per 1M tokens
   - **Optimized**: Can use `text-embedding-3-small` (10x cheaper) via env var

2. **Chat Completions**: `gpt-4-turbo-preview` (All tasks) - *Before optimization*
   - Used for: Classification, tagging, title/description generation, email summaries, general generation
   - Cost: ~$10 per 1M input tokens, ~$30 per 1M output tokens

## Optimizations Implemented

### 1. Model Selection (Estimated 70-90% cost reduction)

**Embeddings:**
- ✅ Configurable via `OPENAI_EMBEDDING_MODEL=small` environment variable
- Defaults to `text-embedding-3-large` for backward compatibility
- When enabled: `text-embedding-3-small` (10x cheaper, 1536 dims vs 3072)
- Cost reduction: ~10x cheaper ($0.13 → $0.02 per 1M tokens)
- **Note**: Requires database migration to support 1536 dimensions (migration file provided)

**Chat Completions:**
- ✅ Changed from `gpt-4-turbo-preview` → `gpt-3.5-turbo` for simple tasks:
  - Classification (`classifyAndTag`)
  - Tag generation (`generateTags`)
  - Title/description generation (`generateTitleAndDescription`)
  - Email summarization (`generateEmailSummary`)
- Cost reduction: ~10-30x cheaper ($10-30 → $0.50-1.50 per 1M tokens)
- ✅ Kept `gpt-4-turbo-preview` for user-facing generation only

### 2. Token Usage Optimizations

**Prompt Optimization:**
- ✅ Reduced content preview lengths:
  - Classification: 2000 → 1500 chars (~25% reduction)
  - Title/description: 4000 → 3000 chars (~25% reduction)
  - Tags: 2000 → 1500 chars (~25% reduction)
  - Email summary: 4000 → 3000 chars (~25% reduction)
- ✅ More concise prompts (removed verbose instructions)
- ✅ Added `max_tokens` limits to all responses:
  - Classification: 200 tokens
  - Title/description: 150 tokens
  - Tags: 100 tokens
  - Email summary: 200 tokens
  - General generation: 1000 tokens

**Structured Output:**
- ✅ Added `response_format: { type: 'json_object' }` where applicable
- Improves reliability and reduces retry attempts
- Better JSON parsing success rate

## Cost Comparison

### Before Optimization:
- Embeddings: ~$0.13 per 1M tokens
- Chat (GPT-4): ~$10-30 per 1M tokens
- **Estimated monthly cost**: High (depending on usage)

### After Optimization:
- Embeddings (large): ~$0.13 per 1M tokens (default, backward compatible)
- Embeddings (small): ~$0.02 per 1M tokens (10x cheaper, when enabled)
- Chat (GPT-3.5): ~$0.50-1.50 per 1M tokens (10-30x cheaper)
- Chat (GPT-4): Only for user-facing generation (minimal usage)
- **Estimated monthly cost**: 70-90% reduction

## Database Migration (Optional)

To enable `text-embedding-3-small` embeddings:

1. **Migration file**: `006_migrate_to_small_embeddings.sql` (already created)
2. **Set environment variable**: `OPENAI_EMBEDDING_MODEL=small`
3. **Run migration**: `npm run migrate`
4. **Regenerate embeddings**: All existing embeddings will need to be regenerated

**Note**: The code defaults to `text-embedding-3-large` for backward compatibility. Only set the env var after running the migration.

## Usage Patterns

### High-Volume Tasks (Now using GPT-3.5):
- Item indexing (classification + tags): ~10-30x cheaper
- Auto-tagging: ~10-30x cheaper
- Title/description generation: ~10-30x cheaper
- Email summaries: ~10-30x cheaper

### Low-Volume Tasks (Keeping GPT-4):
- User-requested content generation: High quality needed

## Additional Optimization Opportunities

### Future Enhancements:
1. **Caching**: Cache common prompts/responses to avoid redundant API calls
2. **Batch Processing**: Batch similar requests when possible
3. **Conditional Processing**: Skip AI for simple/short content that doesn't need processing
4. **Smart Content Truncation**: Use more intelligent truncation (e.g., keep first and last paragraphs)

## Monitoring Recommendations

1. Track token usage per model separately
2. Monitor cost per user/operation
3. Set up alerts for unexpected spikes
4. Review quality of GPT-3.5 outputs vs GPT-4 (should be comparable for simple tasks)
5. Monitor embedding quality (small vs large) for search accuracy

## Summary

**Immediate Savings** (GPT-4 → GPT-3.5 for simple tasks):
- ~70-90% cost reduction on chat completions
- No quality loss expected for classification, tagging, summarization

**Optional Savings** (Large → Small embeddings):
- Additional 10x cost reduction on embeddings
- Requires database migration and regeneration
- Minimal quality impact (1536 dims still very effective)

**Total Potential Savings**: 70-95% reduction in OpenAI costs
