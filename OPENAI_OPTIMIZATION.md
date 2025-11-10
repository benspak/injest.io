# OpenAI API Cost Optimization Analysis

## Current Usage Analysis

### Models Being Used:
1. **Embeddings**: `text-embedding-3-small` (1536 dimensions) - *Default*
   - Used for: Item indexing, search similarity
   - Cost: ~$0.02 per 1M tokens

2. **Chat Completions**: `gpt-4-turbo-preview` (All tasks) - *Before optimization*
   - Used for: Classification, tagging, title/description generation, email summaries, general generation
   - Cost: ~$10 per 1M input tokens, ~$30 per 1M output tokens

## Optimizations Implemented

### 1. Model Selection (Estimated 70-90% cost reduction)

**Embeddings:**
- ✅ Default model is `text-embedding-3-small` (1536 dims, ~10x cheaper than large)
- ✅ Still configurable via `OPENAI_EMBEDDING_MODEL` to allow future model swaps
- Cost: ~$0.02 per 1M tokens
- **Note**: Database schema ships with 1536-dimension vectors; run migration `016_force_small_embeddings.sql` if upgrading from an older install

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
- Embeddings: ~$0.02 per 1M tokens (text-embedding-3-small, default)
- Chat (GPT-3.5): ~$0.50-1.50 per 1M tokens (10-30x cheaper)
- Chat (GPT-4): Only for user-facing generation (minimal usage)
- **Estimated monthly cost**: 70-90% reduction

## Database Migration

Projects created before this change may still have 3072-dimension embeddings. Run the migrations (including `016_force_small_embeddings.sql`) and then re-index items to regenerate embeddings with the smaller dimension.

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

**Total Savings**: 70-95% reduction in OpenAI costs compared to the original large-embedding, GPT-4-only setup.

## Rate Limiting & Error Handling

**Internal Rate Limiter:**
- Set to 400 requests per minute (conservative limit)
- Provides queue management for requests
- Works alongside OpenAI's retry logic

**429 Error Handling:**
- Automatic retry with exponential backoff (up to 5 retries)
- Respects `retry-after` header from OpenAI
- Jitter added to prevent thundering herd problem
- All OpenAI API calls now have automatic retry logic
- Better error detection for various OpenAI SDK error formats
