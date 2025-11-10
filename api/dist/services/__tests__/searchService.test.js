import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SearchService } from '../search.js';
test('serializeFilters normalizes and sorts filter values', () => {
    const service = new SearchService();
    const signature = service.serializeFilters({
        types: ['link', 'note'],
        tags: ['Team', 'alpha'],
        sources: ['Resend', 'notion'],
        uploadedBy: 'me',
        hasAttachments: true,
        dateFrom: '2024-01-01T00:00:00.000Z',
    });
    assert.equal(signature, JSON.stringify([
        ['dateFrom', '2024-01-01T00:00:00.000Z'],
        ['hasAttachments', true],
        ['sources', ['Resend', 'notion']],
        ['tags', ['alpha', 'team']],
        ['types', ['link', 'note']],
        ['uploadedBy', 'me'],
    ]));
});
test('cache stores, reads, and invalidates per user', () => {
    const service = new SearchService();
    const filters = { tags: ['focus'] };
    const cacheKey = service.buildCacheKey('user-1', 'hello world', 5, filters);
    const sampleResult = {
        item: {
            id: 'item-1',
            owner_id: 'user-1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
        similarity: 0.92,
        scores: {
            overall: 0.92,
            vector: 0.88,
            recency: 0.65,
            tagBoost: 0.05,
            titleBoost: 0.02,
            ownerBoost: 0.05,
        },
    };
    service.storeInCache('user-1', cacheKey, [sampleResult]);
    const cachedResults = service.getFromCache(cacheKey);
    assert.ok(cachedResults);
    assert.equal(cachedResults?.length, 1);
    assert.equal(cachedResults?.[0].item.id, 'item-1');
    service.invalidateForUser('user-1');
    const afterInvalidation = service.getFromCache(cacheKey);
    assert.equal(afterInvalidation, null);
});
//# sourceMappingURL=searchService.test.js.map