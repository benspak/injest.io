import { type Item } from '../models/Item.js';
export declare class IndexingService {
    indexItem(itemOrId: Item | string, options?: {
        retries?: number;
    }): Promise<boolean>;
    private performIndexing;
}
export declare const indexingService: IndexingService;
//# sourceMappingURL=indexing.d.ts.map