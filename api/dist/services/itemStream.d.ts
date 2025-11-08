import type { Response } from 'express';
import type { Item } from '../models/Item.js';
type SSEClient = {
    res: Response;
    heartbeat: NodeJS.Timeout;
};
declare class ItemStreamService {
    private clients;
    addClient(userId: string, res: Response): SSEClient;
    removeClient(userId: string, client: SSEClient): void;
    broadcastIndexedItem(item: Item): void;
}
export declare const itemStreamService: ItemStreamService;
export {};
//# sourceMappingURL=itemStream.d.ts.map