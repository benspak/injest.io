import pool from '../config/database.js';
/**
 * Normalizes a name for comparison by:
 * - Converting to lowercase
 * - Trimming whitespace
 * - Removing extra spaces
 * - Removing common suffixes (Jr., Sr., III, etc.)
 * - Removing middle initials
 */
const normalizeNameForMatching = (name) => {
    if (!name) {
        return '';
    }
    let normalized = name
        .toLowerCase()
        .trim()
        // Remove extra spaces
        .replace(/\s+/g, ' ')
        // Remove common suffixes
        .replace(/\s+(jr\.?|sr\.?|ii|iii|iv|v|esq\.?)$/i, '')
        // Remove middle initials (single letter followed by period or space)
        .replace(/\s+[a-z]\.?\s+/g, ' ')
        // Remove periods
        .replace(/\./g, '')
        // Remove commas
        .replace(/,/g, '')
        .trim();
    return normalized;
};
/**
 * Calculates a match score between two normalized names.
 * Returns a score from 0-1, where 1 is an exact match.
 */
const calculateMatchScore = (name1, name2) => {
    if (!name1 || !name2) {
        return 0;
    }
    // Exact match
    if (name1 === name2) {
        return 1.0;
    }
    // Check if one contains the other (partial match)
    if (name1.includes(name2) || name2.includes(name1)) {
        const shorter = name1.length < name2.length ? name1 : name2;
        const longer = name1.length >= name2.length ? name1 : name2;
        // Score based on how much of the shorter name is in the longer one
        return shorter.length / longer.length;
    }
    // Check word-by-word matching
    const words1 = name1.split(/\s+/).filter(Boolean);
    const words2 = name2.split(/\s+/).filter(Boolean);
    if (words1.length === 0 || words2.length === 0) {
        return 0;
    }
    // Count matching words
    let matchingWords = 0;
    const usedWords2 = new Set();
    for (const word1 of words1) {
        for (let i = 0; i < words2.length; i++) {
            if (!usedWords2.has(i) && word1 === words2[i]) {
                matchingWords += 1;
                usedWords2.add(i);
                break;
            }
        }
    }
    // Score based on matching words
    const maxWords = Math.max(words1.length, words2.length);
    return matchingWords / maxWords;
};
/**
 * Builds a full name from user's first and last name
 */
const buildUserFullName = (user) => {
    const firstName = user.first_name?.trim() || '';
    const lastName = user.last_name?.trim() || '';
    if (!firstName && !lastName) {
        return null;
    }
    return `${firstName} ${lastName}`.trim();
};
export class ContactEnrichmentService {
    /**
     * Finds public user profiles that match the given name.
     * Only queries users where profile_private = false (public profiles only).
     */
    async findPublicUsersByName(name) {
        if (!name || name.trim().length === 0) {
            return [];
        }
        const normalizedSearchName = normalizeNameForMatching(name);
        if (normalizedSearchName.length === 0) {
            return [];
        }
        // Build search terms from the normalized name
        const searchTerms = normalizedSearchName.split(/\s+/).filter(Boolean);
        // Security: Validate and sanitize search terms to prevent SQL injection
        // Only allow alphanumeric characters, spaces, hyphens, and apostrophes
        const sanitizedSearchTerms = searchTerms.filter(term => {
            // Allow only safe characters for name searches
            return /^[a-zA-Z0-9\s\-']+$/.test(term) && term.length <= 100;
        });
        if (sanitizedSearchTerms.length === 0) {
            return [];
        }
        // Query public profiles where first_name or last_name matches
        // We'll do a fuzzy match in the application layer
        // Search for the full normalized name and also individual words
        const searchPattern = `%${normalizedSearchName}%`;
        const wordPatterns = sanitizedSearchTerms.map((term) => `%${term}%`);
        // Build conditions for full name match and individual word matches
        const conditions = [
            `LOWER(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) LIKE $1`,
            `LOWER(TRIM(COALESCE(last_name, '') || ' ' || COALESCE(first_name, ''))) LIKE $1`,
        ];
        // Add individual word matches (using sanitized terms)
        sanitizedSearchTerms.forEach((term, index) => {
            const paramIndex = index + 2; // $1 is used for full pattern
            conditions.push(`LOWER(COALESCE(first_name, '')) LIKE $${paramIndex}`);
            conditions.push(`LOWER(COALESCE(last_name, '')) LIKE $${paramIndex}`);
        });
        const params = [searchPattern, ...wordPatterns];
        const result = await pool.query(`
        SELECT *
        FROM users
        WHERE profile_private = false
          AND (
            first_name IS NOT NULL OR last_name IS NOT NULL
          )
          AND (
            ${conditions.join(' OR ')}
          )
        LIMIT 50
      `, params);
        return result.rows;
    }
    /**
     * Matches a contact to a user profile based on name.
     * Only matches against public profiles (profile_private = false).
     * Returns the matched user or null if no good match is found.
     */
    async matchContactToUser(contact) {
        // Build contact name from first_name and last_name
        const contactFirstName = contact.first_name?.trim() || '';
        const contactLastName = contact.last_name?.trim() || '';
        const contactFullName = `${contactFirstName} ${contactLastName}`.trim();
        // Only match if contact has a name
        if (!contactFullName || contactFullName.length === 0) {
            return null;
        }
        const normalizedContactName = normalizeNameForMatching(contactFullName);
        if (normalizedContactName.length === 0) {
            return null;
        }
        try {
            // Find potential matches from public profiles only
            const candidates = await this.findPublicUsersByName(contactFullName);
            if (candidates.length === 0) {
                return null;
            }
            // Score each candidate
            const scoredCandidates = candidates
                .map((user) => {
                const userFullName = buildUserFullName(user);
                if (!userFullName) {
                    return { user, score: 0 };
                }
                const normalizedUserName = normalizeNameForMatching(userFullName);
                const score = calculateMatchScore(normalizedContactName, normalizedUserName);
                return { user, score };
            })
                .filter((candidate) => candidate.score > 0)
                .sort((a, b) => b.score - a.score); // Sort by score descending
            if (scoredCandidates.length === 0) {
                return null;
            }
            // Use the best match if score is above threshold
            const bestMatch = scoredCandidates[0];
            const MIN_MATCH_SCORE = 0.7; // Require at least 70% match confidence
            if (bestMatch.score >= MIN_MATCH_SCORE) {
                return bestMatch.user;
            }
            return null;
        }
        catch (error) {
            console.warn('[ContactEnrichment] Error matching contact to user:', {
                contactId: contact.id,
                error,
            });
            return null;
        }
    }
}
export const contactEnrichmentService = new ContactEnrichmentService();
//# sourceMappingURL=contactEnrichment.js.map