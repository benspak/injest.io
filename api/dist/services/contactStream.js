class ContactStreamService {
    clients = new Map();
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
        const clients = this.clients.get(contact.owner_id);
        if (!clients || clients.size === 0) {
            return;
        }
        const payload = JSON.stringify({
            type: 'upserted',
            contact,
        });
        for (const client of clients) {
            try {
                client.res.write(`event: contact-upserted\ndata: ${payload}\n\n`);
            }
            catch (error) {
                console.error('[ContactStream] Failed to send upserted event:', error);
            }
        }
    }
    broadcastContacts(contacts) {
        contacts.forEach((contact) => {
            this.broadcastContact(contact);
        });
    }
    broadcastContactDeleted(ownerId, contactId) {
        const clients = this.clients.get(ownerId);
        if (!clients || clients.size === 0) {
            return;
        }
        const payload = JSON.stringify({
            type: 'deleted',
            contactId,
        });
        for (const client of clients) {
            try {
                client.res.write(`event: contact-deleted\ndata: ${payload}\n\n`);
            }
            catch (error) {
                console.error('[ContactStream] Failed to send deleted event:', error);
            }
        }
    }
}
export const contactStreamService = new ContactStreamService();
//# sourceMappingURL=contactStream.js.map