import type { Pool, PoolClient } from 'pg';
import pool from '../config/database.js';
import { contactEnrichmentService } from '../services/contactEnrichment.js';

export interface Contact {
  id: string;
  owner_id: string;
  name: string | null; // Deprecated, kept for backward compatibility
  normalized_name: string; // Deprecated, kept for backward compatibility
  first_name: string | null;
  last_name: string | null;
  normalized_first_name: string;
  normalized_last_name: string;
  email: string | null;
  normalized_email: string;
  phone: string | null;
  normalized_phone: string;
  linkedin_url: string | null;
  x_url: string | null;
  github_url: string | null;
  source_item_id: string | null;
  matched_user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertContactInput {
  ownerId: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null; // Deprecated, kept for backward compatibility
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  xUrl?: string | null;
  githubUrl?: string | null;
  sourceItemId?: string | null;
  matchedUserId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListContactsOptions {
  limit?: number;
  offset?: number;
  search?: string | null;
}

export interface UpdateContactInput {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null; // Deprecated, kept for backward compatibility
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  xUrl?: string | null;
  githubUrl?: string | null;
  matchedUserId?: string | null;
  metadata?: Record<string, unknown> | null;
}

const normalizeEmail = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  return value.trim().toLowerCase();
};

const normalizePhone = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  const digits = value.replace(/\D+/g, '');
  return digits;
};

const normalizeName = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  return value.trim().toLowerCase();
};

const normalizeFirstName = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  return value.trim().toLowerCase();
};

const normalizeLastName = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  return value.trim().toLowerCase();
};

// Helper to build full name from first and last name
const buildFullName = (firstName?: string | null, lastName?: string | null): string | null => {
  const first = firstName?.trim() || '';
  const last = lastName?.trim() || '';
  if (!first && !last) {
    return null;
  }
  return `${first} ${last}`.trim();
};

const sanitizeNullable = (value?: string | null): string | null => {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeUrl = (value?: string | null): string | null => {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  // Remove trailing slashes and whitespace
  const cleaned = trimmed.replace(/\/+$/, '').trim();
  if (cleaned.length === 0 || cleaned === 'http://' || cleaned === 'https://') {
    return null;
  }
  // If it already starts with http:// or https:// and has content after, use it as-is
  if (cleaned.match(/^https?:\/\/.+/i)) {
    return cleaned;
  }
  // If it doesn't start with a protocol, prepend https://
  // Allow common patterns like domain.com/path or www.domain.com/path
  if (cleaned.match(/^[a-zA-Z0-9]/)) {
    return `https://${cleaned}`;
  }
  // If it doesn't look like a valid URL, return null
  return null;
};

const mergeMetadata = (
  existing: Record<string, unknown> | null,
  incoming: Record<string, unknown> | null | undefined
): Record<string, unknown> | null => {
  if (!existing && !incoming) {
    return null;
  }
  return {
    ...(existing ?? {}),
    ...(incoming ?? {}),
  };
};

const buildContactSearchFilters = (ownerId: string, search?: string | null) => {
  const whereClauses = ['owner_id = $1'];
  const params: Array<string | number> = [ownerId];

    if (search && search.trim().length > 0) {
      const normalizedQuery = search.trim().toLowerCase();
      const likeQuery = `%${normalizedQuery}%`;
      const digitsOnly = normalizedQuery.replace(/\D+/g, '');

      params.push(likeQuery);
      const searchConditions = [
        `normalized_first_name LIKE $${params.length}`,
        `normalized_last_name LIKE $${params.length}`,
        `(normalized_first_name || ' ' || normalized_last_name) LIKE $${params.length}`,
        `normalized_name LIKE $${params.length}`,
        `normalized_email LIKE $${params.length}`,
      ];

      if (digitsOnly.length > 0) {
        params.push(`%${digitsOnly}%`);
        searchConditions.push(`normalized_phone LIKE $${params.length}`);
      }

      whereClauses.push(`(${searchConditions.join(' OR ')})`);
    }

  return { whereClauses, params };
};

export class ContactModel {
  static async upsert(
    input: UpsertContactInput,
    client: Pool | PoolClient = pool
  ): Promise<Contact | null> {
    // Handle firstName/lastName or parse from name (backward compatibility)
    let firstName: string | null = sanitizeNullable(input.firstName);
    let lastName: string | null = sanitizeNullable(input.lastName);

    // If name is provided but firstName/lastName are not, parse name
    if (input.name && !firstName && !lastName) {
      const nameParts = input.name.trim().split(/\s+/);
      if (nameParts.length > 0) {
        firstName = sanitizeNullable(nameParts[0]);
        if (nameParts.length > 1) {
          lastName = sanitizeNullable(nameParts.slice(1).join(' '));
        }
      }
    }

    // Build full name for backward compatibility
    const name = buildFullName(firstName, lastName);

    const email = sanitizeNullable(input.email);
    const phone = sanitizeNullable(input.phone);
    const linkedinUrl = sanitizeUrl(input.linkedinUrl);
    const xUrl = sanitizeUrl(input.xUrl);
    const githubUrl = sanitizeUrl(input.githubUrl);

    const normalizedFirstName = normalizeFirstName(firstName);
    const normalizedLastName = normalizeLastName(lastName);
    const normalizedName = normalizeName(name);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    if (!firstName && !lastName && !email && !phone) {
      return null;
    }

    const metadata = mergeMetadata(null, input.metadata) ?? {};

    const result = await client.query<Contact>(
      `
        INSERT INTO contacts (
          owner_id,
          name,
          normalized_name,
          first_name,
          last_name,
          normalized_first_name,
          normalized_last_name,
          email,
          normalized_email,
          phone,
          normalized_phone,
          linkedin_url,
          x_url,
          github_url,
          source_item_id,
          matched_user_id,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (owner_id, normalized_email, normalized_phone, normalized_first_name, normalized_last_name)
        DO UPDATE SET
          name = CASE
            WHEN EXCLUDED.name IS NOT NULL THEN EXCLUDED.name
            ELSE contacts.name
          END,
          normalized_name = CASE
            WHEN EXCLUDED.normalized_name <> '' THEN EXCLUDED.normalized_name
            ELSE contacts.normalized_name
          END,
          first_name = CASE
            WHEN EXCLUDED.first_name IS NOT NULL THEN EXCLUDED.first_name
            ELSE contacts.first_name
          END,
          last_name = CASE
            WHEN EXCLUDED.last_name IS NOT NULL THEN EXCLUDED.last_name
            ELSE contacts.last_name
          END,
          normalized_first_name = CASE
            WHEN EXCLUDED.normalized_first_name <> '' THEN EXCLUDED.normalized_first_name
            ELSE contacts.normalized_first_name
          END,
          normalized_last_name = CASE
            WHEN EXCLUDED.normalized_last_name <> '' THEN EXCLUDED.normalized_last_name
            ELSE contacts.normalized_last_name
          END,
          email = CASE
            WHEN EXCLUDED.email IS NOT NULL THEN EXCLUDED.email
            ELSE contacts.email
          END,
          normalized_email = CASE
            WHEN EXCLUDED.normalized_email <> '' THEN EXCLUDED.normalized_email
            ELSE contacts.normalized_email
          END,
          phone = CASE
            WHEN EXCLUDED.phone IS NOT NULL THEN EXCLUDED.phone
            ELSE contacts.phone
          END,
          normalized_phone = CASE
            WHEN EXCLUDED.normalized_phone <> '' THEN EXCLUDED.normalized_phone
            ELSE contacts.normalized_phone
          END,
          linkedin_url = COALESCE(EXCLUDED.linkedin_url, contacts.linkedin_url),
          x_url = COALESCE(EXCLUDED.x_url, contacts.x_url),
          github_url = COALESCE(EXCLUDED.github_url, contacts.github_url),
          source_item_id = COALESCE(contacts.source_item_id, EXCLUDED.source_item_id),
          matched_user_id = COALESCE(EXCLUDED.matched_user_id, contacts.matched_user_id),
          metadata = jsonb_strip_nulls(COALESCE(contacts.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb)),
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `,
      [
        input.ownerId,
        name,
        normalizedName,
        firstName,
        lastName,
        normalizedFirstName,
        normalizedLastName,
        email,
        normalizedEmail,
        phone,
        normalizedPhone,
        linkedinUrl,
        xUrl,
        githubUrl,
        input.sourceItemId ?? null,
        input.matchedUserId ?? null,
        metadata,
      ]
    );

    const contact = result.rows[0] ?? null;
    if (!contact) {
      return null;
    }

    // Run enrichment if matchedUserId was not explicitly provided
    if (input.matchedUserId === undefined && (contact.first_name || contact.last_name)) {
      try {
        const matchedUser = await contactEnrichmentService.matchContactToUser(contact);
        if (matchedUser && matchedUser.id !== contact.matched_user_id) {
          // Enrich social links from matched user profile (only if contact doesn't have them)
          const enrichedLinkedinUrl = contact.linkedin_url || matchedUser.linkedin_url || null;
          const enrichedXUrl = contact.x_url || matchedUser.x_profile_url || null;
          const enrichedGithubUrl = contact.github_url || matchedUser.github_url || null;

          // Update the contact with the matched user ID and enriched social links
          const updateResult = await client.query<Contact>(
            `
              UPDATE contacts
              SET
                matched_user_id = $1,
                linkedin_url = COALESCE($2, linkedin_url),
                x_url = COALESCE($3, x_url),
                github_url = COALESCE($4, github_url),
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $5
              RETURNING *
            `,
            [matchedUser.id, enrichedLinkedinUrl, enrichedXUrl, enrichedGithubUrl, contact.id]
          );
          return updateResult.rows[0] ?? contact;
        }
      } catch (error) {
        // Enrichment failures should not block contact creation/updates
        console.warn('[ContactModel] Failed to enrich contact during upsert:', {
          contactId: contact.id,
          error,
        });
      }
    }

    return contact;
  }

  static async upsertMany(
    inputs: UpsertContactInput[],
    client: Pool | PoolClient = pool
  ): Promise<Contact[]> {
    const results: Contact[] = [];

    for (const input of inputs) {
      const contact = await this.upsert(input, client);
      if (contact) {
        results.push(contact);
      }
    }

    return results;
  }

  static async listByOwner(
    ownerId: string,
    options: ListContactsOptions = {}
  ): Promise<Contact[]> {
    const { limit = 100, offset = 0, search } = options;

    const { whereClauses, params } = buildContactSearchFilters(ownerId, search);
    const queryParams = [...params];
    const limitParamIndex = queryParams.length + 1;
    queryParams.push(limit);
    const offsetParamIndex = queryParams.length + 1;
    queryParams.push(offset);

    const result = await pool.query<Contact>(
      `
        SELECT *
        FROM contacts
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY updated_at DESC
        LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
      `,
      queryParams
    );

    return result.rows ?? [];
  }

  static async countByOwner(
    ownerId: string,
    options: { search?: string | null } = {}
  ): Promise<number> {
    const { whereClauses, params } = buildContactSearchFilters(ownerId, options.search);

    const result = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM contacts
        WHERE ${whereClauses.join(' AND ')}
      `,
      params
    );

    const countValue = result.rows[0]?.count ?? '0';
    return Number.parseInt(countValue, 10);
  }

  static async findByOwnerAndId(
    ownerId: string,
    contactId: string,
    client: Pool | PoolClient = pool
  ): Promise<Contact | null> {
    const result = await client.query<Contact>(
      `
        SELECT *
        FROM contacts
        WHERE owner_id = $1
          AND id = $2
        LIMIT 1
      `,
      [ownerId, contactId]
    );

    return result.rows[0] ?? null;
  }

  static async findById(contactId: string): Promise<Contact | null> {
    const result = await pool.query<Contact>(
      `
        SELECT *
        FROM contacts
        WHERE id = $1
        LIMIT 1
      `,
      [contactId]
    );

    return result.rows[0] ?? null;
  }

  static async update(
    ownerId: string,
    contactId: string,
    updates: UpdateContactInput,
    client: Pool | PoolClient = pool
  ): Promise<Contact | null> {
    const existing = await this.findByOwnerAndId(ownerId, contactId, client);
    if (!existing) {
      return null;
    }

    // Handle firstName/lastName or parse from name (backward compatibility)
    let firstName: string | null =
      updates.firstName !== undefined ? sanitizeNullable(updates.firstName) : existing.first_name;
    let lastName: string | null =
      updates.lastName !== undefined ? sanitizeNullable(updates.lastName) : existing.last_name;

    // If name is provided but firstName/lastName are not, parse name
    if (updates.name !== undefined && updates.firstName === undefined && updates.lastName === undefined) {
      if (updates.name) {
        const nameParts = updates.name.trim().split(/\s+/);
        if (nameParts.length > 0) {
          firstName = sanitizeNullable(nameParts[0]);
          if (nameParts.length > 1) {
            lastName = sanitizeNullable(nameParts.slice(1).join(' '));
          } else {
            lastName = null;
          }
        } else {
          firstName = null;
          lastName = null;
        }
      } else {
        firstName = null;
        lastName = null;
      }
    }

    // Build full name for backward compatibility
    const name = buildFullName(firstName, lastName);

    const email =
      updates.email !== undefined ? sanitizeNullable(updates.email) : existing.email;
    const phone =
      updates.phone !== undefined ? sanitizeNullable(updates.phone) : existing.phone;
    const linkedinUrl =
      updates.linkedinUrl !== undefined ? sanitizeUrl(updates.linkedinUrl) : existing.linkedin_url;
    const xUrl =
      updates.xUrl !== undefined ? sanitizeUrl(updates.xUrl) : existing.x_url;
    const githubUrl =
      updates.githubUrl !== undefined ? sanitizeUrl(updates.githubUrl) : existing.github_url;
    const matchedUserId =
      updates.matchedUserId !== undefined ? updates.matchedUserId : existing.matched_user_id;

    if (!firstName && !lastName && !email && !phone) {
      throw new Error('At least one of first name, last name, email, or phone must be provided.');
    }

    const normalizedFirstName = normalizeFirstName(firstName);
    const normalizedLastName = normalizeLastName(lastName);
    const normalizedName = normalizeName(name);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    const metadata =
      updates.metadata !== undefined
        ? mergeMetadata(existing.metadata, updates.metadata)
        : existing.metadata;

    // Check if name changed (for re-running enrichment)
    const nameChanged =
      (updates.firstName !== undefined && firstName !== existing.first_name) ||
      (updates.lastName !== undefined && lastName !== existing.last_name) ||
      (updates.name !== undefined && name !== existing.name);

    const result = await client.query<Contact>(
      `
        UPDATE contacts
        SET
          name = $1,
          normalized_name = $2,
          first_name = $3,
          last_name = $4,
          normalized_first_name = $5,
          normalized_last_name = $6,
          email = $7,
          normalized_email = $8,
          phone = $9,
          normalized_phone = $10,
          linkedin_url = $11,
          x_url = $12,
          github_url = $13,
          matched_user_id = $14,
          metadata = COALESCE($15::jsonb, '{}'::jsonb),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $16
          AND owner_id = $17
        RETURNING *
      `,
      [
        name,
        normalizedName,
        firstName,
        lastName,
        normalizedFirstName,
        normalizedLastName,
        email,
        normalizedEmail,
        phone,
        normalizedPhone,
        linkedinUrl,
        xUrl,
        githubUrl,
        matchedUserId,
        metadata,
        contactId,
        ownerId,
      ]
    );

    const contact = result.rows[0] ?? null;
    if (!contact) {
      return null;
    }

    // Re-run enrichment if name changed and matchedUserId was not explicitly provided
    if (nameChanged && updates.matchedUserId === undefined && (contact.first_name || contact.last_name)) {
      try {
        const matchedUser = await contactEnrichmentService.matchContactToUser(contact);
        if (matchedUser && matchedUser.id !== contact.matched_user_id) {
          // Enrich social links from matched user profile (only if contact doesn't have them)
          const enrichedLinkedinUrl = contact.linkedin_url || matchedUser.linkedin_url || null;
          const enrichedXUrl = contact.x_url || matchedUser.x_profile_url || null;
          const enrichedGithubUrl = contact.github_url || matchedUser.github_url || null;

          // Update the contact with the matched user ID and enriched social links
          const updateResult = await client.query<Contact>(
            `
              UPDATE contacts
              SET
                matched_user_id = $1,
                linkedin_url = COALESCE($2, linkedin_url),
                x_url = COALESCE($3, x_url),
                github_url = COALESCE($4, github_url),
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $5
              RETURNING *
            `,
            [matchedUser.id, enrichedLinkedinUrl, enrichedXUrl, enrichedGithubUrl, contact.id]
          );
          return updateResult.rows[0] ?? contact;
        }
      } catch (error) {
        // Enrichment failures should not block contact updates
        console.warn('[ContactModel] Failed to enrich contact during update:', {
          contactId: contact.id,
          error,
        });
      }
    }

    return contact;
  }

  static async delete(
    ownerId: string,
    contactId: string,
    client: Pool | PoolClient = pool
  ): Promise<boolean> {
    const result = await client.query(
      `
        DELETE FROM contacts
        WHERE id = $1
          AND owner_id = $2
      `,
      [contactId, ownerId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  private static normalizeDomain(domain?: string | null): string | null {
    if (!domain) {
      return null;
    }
    const trimmed = domain.trim().toLowerCase();
    if (!trimmed) {
      return null;
    }
    return trimmed
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split(/[/?#]/)[0]
      .trim();
  }

  static async searchForSend(
    ownerId: string,
    options: {
      domain?: string | null;
      keywords?: string[] | null;
      limit?: number;
      excludeIds?: string[] | null;
    } = {}
  ): Promise<Contact[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 10, 50));
    const normalizedDomain = this.normalizeDomain(options.domain);
    const keywords = Array.isArray(options.keywords)
      ? options.keywords
          .map((word) => word?.toString().trim().toLowerCase())
          .filter((word): word is string => Boolean(word))
      : [];
    const excludeIds = Array.isArray(options.excludeIds)
      ? options.excludeIds
          .map((id) => id?.toString().trim())
          .filter((id): id is string => Boolean(id))
      : [];

    const whereClauses = ['owner_id = $1'];
    const params: Array<string | number | string[]> = [ownerId];
    const orderSegments: string[] = [];

    if (normalizedDomain) {
      params.push(`%${normalizedDomain}`);
      const domainIndex = params.length;
      whereClauses.push(`normalized_email LIKE $${domainIndex}`);
      orderSegments.push(`CASE WHEN normalized_email LIKE $${domainIndex} THEN 1 ELSE 0 END DESC`);
    }

    if (keywords.length > 0) {
      const keywordClauses: string[] = [];
      for (const keyword of keywords) {
        params.push(`%${keyword}%`);
        const keywordIndex = params.length;
        keywordClauses.push(`normalized_name LIKE $${keywordIndex}`);
        keywordClauses.push(`normalized_email LIKE $${keywordIndex}`);
      }
      if (keywordClauses.length > 0) {
        const grouped = [];
        for (let i = 0; i < keywordClauses.length; i += 2) {
          grouped.push(`(${keywordClauses[i]} OR ${keywordClauses[i + 1]})`);
        }
        whereClauses.push(`(${grouped.join(' OR ')})`);
      }
    }

    if (excludeIds.length > 0) {
      params.push(excludeIds);
      const excludeIndex = params.length;
      whereClauses.push(`id <> ALL($${excludeIndex}::uuid[])`);
    }

    const orderBy =
      orderSegments.length > 0
        ? `${orderSegments.join(', ')}, updated_at DESC`
        : 'updated_at DESC';

    params.push(limit);
    const limitIndex = params.length;

    const result = await pool.query<Contact>(
      `
        SELECT *
        FROM contacts
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT $${limitIndex}
      `,
      params
    );

    return result.rows ?? [];
  }
}

export const contactNormalizers = {
  email: normalizeEmail,
  phone: normalizePhone,
  name: normalizeName,
};
