import type { Response } from 'express';
import type { Contact } from '../models/Contact.js';

type SSEClient = {
  res: Response;
  heartbeat: NodeJS.Timeout;
};

class ContactStreamService {
  private clients: Map<string, Set<SSEClient>> = new Map();

  private broadcastToClients(ownerId: string, eventName: string, payload: Record<string, unknown>): void {
    const clients = this.clients.get(ownerId);
    if (!clients || clients.size === 0) {
      return;
    }

    const body = JSON.stringify(payload);

    for (const client of clients) {
      try {
        client.res.write(`event: ${eventName}\ndata: ${body}\n\n`);
      } catch (error) {
        console.error('[ContactStream] Failed to send event:', {
          event: eventName,
          error,
        });
      }
    }
  }

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

  broadcastContact(contact: Contact): void {
    this.broadcastToClients(contact.owner_id, 'contact-upserted', {
      type: 'upserted',
      contact,
    });
  }

  broadcastContacts(contacts: Contact[]): void {
    contacts.forEach((contact) => {
      this.broadcastContact(contact);
    });
  }

  broadcastContactDeleted(ownerId: string, contactId: string): void {
    this.broadcastToClients(ownerId, 'contact-deleted', {
      type: 'deleted',
      contactId,
    });
  }

  broadcastImportStatus(
    ownerId: string,
    update: {
      status: 'started' | 'completed' | 'failed';
      importId: string;
      fileName?: string;
      total?: number;
      imported?: number;
      skipped?: {
        duplicates: number;
        missingDetails: number;
      };
      error?: string;
    }
  ): void {
    this.broadcastToClients(ownerId, 'contact-import', {
      type: 'import-status',
      ...update,
    });
  }
}

export const contactStreamService = new ContactStreamService();
