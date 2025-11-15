import { PoolClient } from 'pg';
import { Item } from './Item.js';
import { Collection } from './Collection.js';
export interface CollectionItem {
    collection_id: string;
    item_id: string;
    created_at: Date;
}
export declare class CollectionItemModel {
    static addItem(collectionId: string, itemId: string, client?: PoolClient): Promise<CollectionItem>;
    static removeItem(collectionId: string, itemId: string, client?: PoolClient): Promise<boolean>;
    static findByCollection(collectionId: string, limit?: number, offset?: number): Promise<Item[]>;
    static countByCollection(collectionId: string): Promise<number>;
    static findByItem(itemId: string): Promise<Collection[]>;
    static isItemInCollection(collectionId: string, itemId: string): Promise<boolean>;
    static addItems(collectionId: string, itemIds: string[], client?: PoolClient): Promise<number>;
}
//# sourceMappingURL=CollectionItem.d.ts.map