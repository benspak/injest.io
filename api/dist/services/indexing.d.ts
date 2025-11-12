import { type Item } from '../models/Item.js';
import { type Contact } from '../models/Contact.js';
import { type SearchEntityType } from '../models/SearchDocument.js';
interface IndexingOptions {
    retries?: number;
}
export declare class IndexingService {
    indexItem(itemOrId: Item | string, options?: IndexingOptions): Promise<boolean>;
    indexContact(contactOrId: Contact | string): Promise<boolean>;
    removeSearchDocument(entityType: SearchEntityType, entityId: string): Promise<void>;
    private performItemIndexing;
    private performContactIndexing;
}
export declare const indexingService: IndexingService;
export {};
//# sourceMappingURL=indexing.d.ts.map