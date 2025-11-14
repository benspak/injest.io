import type { Contact } from '../models/Contact.js';
import type { User } from '../models/User.js';
export declare class ContactEnrichmentService {
    /**
     * Finds public user profiles that match the given name.
     * Only queries users where profile_private = false (public profiles only).
     */
    private findPublicUsersByName;
    /**
     * Matches a contact to a user profile based on name.
     * Only matches against public profiles (profile_private = false).
     * Returns the matched user or null if no good match is found.
     */
    matchContactToUser(contact: Contact): Promise<User | null>;
}
export declare const contactEnrichmentService: ContactEnrichmentService;
//# sourceMappingURL=contactEnrichment.d.ts.map