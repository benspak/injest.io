// Type definitions matching the backend API

export interface User {
  id: string;
  email: string;
  verified: boolean;
  is_premium?: boolean;
  subscription_tier?: string;
  public_username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
}

export interface Item {
  id: string;
  owner_id: string;
  type?: 'note' | 'link' | 'file' | 'email';
  raw?: string;
  title?: string;
  description?: string;
  url?: string;
  attachments?: ItemAttachment[];
  clean?: string;
  tags?: string[];
  source?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ItemAttachment {
  filename: string;
  originalname: string;
  mimetype?: string;
  size?: number;
  url?: string;
}

export interface Collection {
  id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface SearchResult {
  entityType: 'item' | 'contact';
  entityId: string;
  item?: Item;
  similarity: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface TwoFactorResponse {
  twoFactorRequired: true;
  pendingToken: string;
  user: User;
}
