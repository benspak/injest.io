import type { Response } from 'express';
import type { Item } from '../models/Item.js';
import { normalizeItem } from '../utils/itemNormalization.js';

type SSEClient = {
  res: Response;
  heartbeat: NodeJS.Timeout;
};

class ItemStreamService {
  private clients: Map<string, Set<SSEClient>> = new Map();

  addClient(userId: string, res: Response): SSEClient {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }

    const heartbeat = setInterval(() => {
      res.write(`event: heartbeat\ndata: {}\n\n`);
    }, 25000);

    const client: SSEClient = { res, heartbeat };
    this.clients.get(userId)!.add(client);

    res.write(`event: connected\ndata: {}\n\n`);
    return client;
  }

  removeClient(userId: string, client: SSEClient): void {
    const clients = this.clients.get(userId);
    if (!clients) {
      return;
    }

    if (clients.has(client)) {
      clearInterval(client.heartbeat);
      clients.delete(client);
    }

    if (clients.size === 0) {
      this.clients.delete(userId);
    }
  }

  broadcastIndexedItem(item: Item): void {
    const clients = this.clients.get(item.owner_id);
    if (!clients || clients.size === 0) {
      return;
    }

    const normalizedItem = normalizeItem(item);
    const payload = JSON.stringify({
      type: 'indexed',
      item: normalizedItem,
    });

    for (const client of clients) {
      try {
        client.res.write(`event: indexed\ndata: ${payload}\n\n`);
      } catch (error) {
        console.error('[ItemStream] Failed to send indexed event:', error);
      }
    }
  }
}

export const itemStreamService = new ItemStreamService();
