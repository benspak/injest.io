import type { BaseEntity } from './index.js';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer',
}

export interface User extends BaseEntity {
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  avatarUrl?: string;
  isActive: boolean;
}

export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  maxConnectors: number;
  maxDataVolume: number;
}

export interface ApiKey extends BaseEntity {
  userId: string;
  organizationId: string;
  name: string;
  keyHash: string;
  keyPrefix: string; // First 8 chars for display
  expiresAt?: Date;
  lastUsedAt?: Date;
  permissions: string[];
}
