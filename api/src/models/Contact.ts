import type { Pool, PoolClient } from 'pg';
import pool from '../config/database.js';

export interface Contact {
  id: string;
  owner_id: string;
  name: string | null;
  normalized_name: string;
  email: string | null;
  normalized_email: string;
  phone: string | null;
  normalized_phone: string;
  source_item_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertContactInput {
  ownerId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  sourceItemId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListContactsOptions {
  limit?: number;
  offset?: number;
}

export interface UpdateContactInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
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

const sanitizeNullable = (value?: string | null): string | null => {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

export class ContactModel {
  static async upsert(
    input: UpsertContactInput,
    client: Pool | PoolClient = pool
  ): Promise<Contact | null> {
    const name = sanitizeNullable(input.name);
    const email = sanitizeNullable(input.email);
    const phone = sanitizeNullable(input.phone);

    const normalizedName = normalizeName(name);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    if (!name && !email && !phone) {
      return null;
    }

    const metadata = mergeMetadata(null, input.metadata) ?? {};

    const result = await client.query<Contact>(
      `
        INSERT INTO contacts (
          owner_id,
          name,
          normalized_name,
          email,
          normalized_email,
          phone,
          normalized_phone,
          source_item_id,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (owner_id, normalized_email, normalized_phone, normalized_name)
        DO UPDATE SET
          name = CASE
            WHEN EXCLUDED.name IS NOT NULL THEN EXCLUDED.name
            ELSE contacts.name
          END,
          normalized_name = CASE
            WHEN EXCLUDED.normalized_name <> '' THEN EXCLUDED.normalized_name
            ELSE contacts.normalized_name
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
          source_item_id = COALESCE(contacts.source_item_id, EXCLUDED.source_item_id),
          metadata = jsonb_strip_nulls(COALESCE(contacts.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb)),
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `,
      [
        input.ownerId,
        name,
        normalizedName,
        email,
        normalizedEmail,
        phone,
        normalizedPhone,
        input.sourceItemId ?? null,
        metadata,
      ]
    );

    return result.rows[0] ?? null;
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
    const { limit = 100, offset = 0 } = options;

    const result = await pool.query<Contact>(
      `
        SELECT *
        FROM contacts
        WHERE owner_id = $1
        ORDER BY updated_at DESC
        LIMIT $2 OFFSET $3
      `,
      [ownerId, limit, offset]
    );

    return result.rows ?? [];
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

    const name =
      updates.name !== undefined ? sanitizeNullable(updates.name) : existing.name;
    const email =
      updates.email !== undefined ? sanitizeNullable(updates.email) : existing.email;
    const phone =
      updates.phone !== undefined ? sanitizeNullable(updates.phone) : existing.phone;

    if (!name && !email && !phone) {
      throw new Error('At least one of name, email, or phone must be provided.');
    }

    const normalizedName = normalizeName(name);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    const metadata =
      updates.metadata !== undefined
        ? mergeMetadata(existing.metadata, updates.metadata)
        : existing.metadata;

    const result = await client.query<Contact>(
      `
        UPDATE contacts
        SET
          name = $1,
          normalized_name = $2,
          email = $3,
          normalized_email = $4,
          phone = $5,
          normalized_phone = $6,
          metadata = COALESCE($7::jsonb, '{}'::jsonb),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
          AND owner_id = $9
        RETURNING *
      `,
      [
        name,
        normalizedName,
        email,
        normalizedEmail,
        phone,
        normalizedPhone,
        metadata,
        contactId,
        ownerId,
      ]
    );

    return result.rows[0] ?? null;
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
}

export const contactNormalizers = {
  email: normalizeEmail,
  phone: normalizePhone,
  name: normalizeName,
};
