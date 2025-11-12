class ContactStreamService {
    clients = new Map();
    broadcastToClients(ownerId, eventName, payload) {
        const clients = this.clients.get(ownerId);
        if (!clients || clients.size === 0) {
            return;
        }
        const body = JSON.stringify(payload);
        for (const client of clients) {
            try {
                client.res.write(`event: ${eventName}\ndata: ${body}\n\n`);
            }
            catch (error) {
                console.error('[ContactStream] Failed to send event:', {
                    event: eventName,
                    error,
                });
            }
        }
    }
    addClient(userId, res) {
        if (!this.clients.has(userId)) {
            this.clients.set(userId, new Set());
        }
        const heartbeat = setInterval(() => {
            res.write(`event: heartbeat\ndata: {}\n\n`);
        }, 25000);
        const client = { res, heartbeat };
        this.clients.get(userId).add(client);
        res.write(`event: connected\ndata: {}\n\n`);
        return client;
    }
    removeClient(userId, client) {
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
    broadcastContact(contact) {
        this.broadcastToClients(contact.owner_id, 'contact-upserted', {
            type: 'upserted',
            contact,
        });
    }
    broadcastContacts(contacts) {
        contacts.forEach((contact) => {
            this.broadcastContact(contact);
        });
    }
    broadcastContactDeleted(ownerId, contactId) {
        this.broadcastToClients(ownerId, 'contact-deleted', {
            type: 'deleted',
            contactId,
        });
    }
    broadcastImportStatus(ownerId, update) {
        this.broadcastToClients(ownerId, 'contact-import', {
            type: 'import-status',
            ...update,
        });
    }
}
export const contactStreamService = new ContactStreamService();
//# sourceMappingURL=contactStream.js.map