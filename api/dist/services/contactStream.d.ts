import type { Response } from 'express';
import type { Contact } from '../models/Contact.js';
type SSEClient = {
    res: Response;
    heartbeat: NodeJS.Timeout;
};
declare class ContactStreamService {
    private clients;
    addClient(userId: string, res: Response): SSEClient;
    removeClient(userId: string, client: SSEClient): void;
    broadcastContact(contact: Contact): void;
    broadcastContacts(contacts: Contact[]): void;
    broadcastContactDeleted(ownerId: string, contactId: string): void;
}
export declare const contactStreamService: ContactStreamService;
export {};
//# sourceMappingURL=contactStream.d.ts.map