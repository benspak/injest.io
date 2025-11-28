import type { SubscriptionTier } from './subscriptionPlans';

// Normalize API URL to ensure it has a protocol and is properly formatted
function normalizeApiUrl(url: string): string {
  if (!url || url.trim() === '') {
    return 'http://localhost:5555';
  }

  // Remove trailing slashes
  url = url.trim().replace(/\/+$/, '');

  // If URL doesn't start with http:// or https://, add protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Determine protocol based on context
    let protocol = 'https://';

    if (typeof window !== 'undefined') {
      // Browser context: use same protocol as current page
      protocol = window.location.protocol === 'https:' ? 'https://' : 'http://';
    } else {
      // Server-side: use HTTPS for production domains, HTTP for localhost
      if (url.includes('localhost') || url.startsWith('127.0.0.1') || url.includes('.local')) {
        protocol = 'http://';
      }
    }

    // Handle Render service names (e.g., "injest-api" -> "injest-api.onrender.com")
    // If it's just a service name without a domain, we can't construct the full URL
    // This case should be handled by proper environment variable configuration
    if (!url.includes('.') && !url.includes('localhost') && !url.startsWith('127.0.0.1')) {
      console.warn(`[API] Warning: API URL appears to be incomplete: "${url}". Please ensure NEXT_PUBLIC_API_URL includes the full domain.`);
    }

    return `${protocol}${url}`;
  }

  return url;
}

export const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5555');

export class ApiError<TData = unknown> extends Error {
  status: number;
  data?: TData;

  constructor(message: string, status: number, data?: TData) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  url: string;
}

export interface ItemAttachment {
  filename: string;
  originalname: string;
  mimetype?: string;
  size?: number;
  attachmentId?: string;
  checksum?: string;
  url?: string;
  id?: string;
  // Optional content ID preserved from inbound email providers for CID inline images
  contentId?: string;
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
  embedding_id?: string;
  link_metadata?: LinkMetadata;
  notes?: string;
  posted_to_profile?: boolean;
  created_at: string;
  updated_at: string;
  // Flag to indicate if this is a Resend email (not in database)
  isResendEmail?: boolean;
  resendEmailId?: string;
}

export interface Collection {
  id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  posted_to_profile?: boolean;
  is_publicly_shareable?: boolean;
  share_token?: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
  items?: Item[]; // For public collection view
}

export interface CollectionItem {
  collection_id: string;
  item_id: string;
  created_at: string;
}

export interface Contact {
  id: string;
  owner_id: string;
  name: string | null; // Deprecated, kept for backward compatibility
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  github_url: string | null;
  source_item_id: string | null;
  matched_user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ContactListResponse {
  contacts: Contact[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
}

export interface ContactImportResponse {
  message: string;
  processed: number;
  imported: number;
  skipped: {
    duplicates: number;
    missingDetails: number;
  };
}

export interface UploadAcknowledgementFile {
  filename: string;
  storedFilename: string;
  mimetype?: string;
  size?: number;
}

export interface UploadAcknowledgement {
  queued: true;
  uploadedCount: number;
  duplicateCount: number;
  message: string;
  files: UploadAcknowledgementFile[];
  duplicates?: Array<{ filename: string; itemId: string; title?: string | null }>;
}

export type CreateItemResponse = Item | UploadAcknowledgement;

export interface User {
  id: string;
  email: string;
  verified: boolean;
  is_premium?: boolean;
  subscription_tier?: SubscriptionTier;
  two_factor_enabled?: boolean;
  two_factor_confirmed_at?: string | null;
  public_username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  headline?: string | null;
  bio?: string | null;
  company?: string | null;
  project_title?: string | null;
  project_description?: string | null;
  zip_code?: string | null;
  city?: string | null;
  avatar_url?: string | null;
  x_profile_url?: string | null;
  youtube_url?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  profile_private?: boolean;
  inbound_email_handle?: string | null;
  recovery_email?: string | null;
}

export interface PublicProfile {
  id: string;
  public_username: string | null;
  first_name: string | null;
  last_name: string | null;
  headline: string | null;
  bio: string | null;
  company: string | null;
  project_title: string | null;
  project_description: string | null;
  city: string | null;
  avatar_url: string | null;
  x_profile_url: string | null;
  youtube_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  created_at: string;
}

export interface ProfileUpdateData {
  public_username?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  bio?: string;
  company?: string;
  project_title?: string;
  project_description?: string;
  zip_code?: string;
  x_profile_url?: string;
  youtube_url?: string;
  github_url?: string;
  linkedin_url?: string;
  avatar?: File;
}


export interface TwoFactorStatus {
  enabled: boolean;
  confirmedAt: string | null;
  recoveryCodesRemaining: number;
}

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
  user: User;
}

export interface TwoFactorVerifyResponse {
  enabled: boolean;
  recoveryCodes: string[];
  user: User;
}

export interface TwoFactorChallengeResponse {
  token: string;
  user: User;
  recoveryCodeUsed: boolean;
  recoveryCodesRemaining: number;
}

export interface TwoFactorDisableResponse {
  success: boolean;
  user: User;
}

export interface SearchResultScores {
  overall: number;
  vector: number;
  recency: number;
  tagBoost: number;
  titleBoost: number;
  ownerBoost: number;
}

export interface SearchResult {
  entityType: 'item' | 'contact';
  entityId: string;
  item?: Item;
  contact?: Contact;
  document?: {
    title: string | null;
    summary: string | null;
    tags: string[] | null;
    metadata: Record<string, unknown> | null;
  };
  similarity: number;
  scores?: SearchResultScores;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

export interface SendPlanAnalysis {
  summary: string;
  intent: string;
  targetCompany?: string;
  targetDomain?: string;
  targetPersona?: string;
  tone?: string;
  searchQuery: string;
  keyFacts: string[];
}

export interface SendPlanContact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  sourceItemId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SendPlanItem {
  id: string;
  type?: string;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  tags?: string[] | null;
  source?: string | null;
  similarity: number;
  scores?: SearchResultScores;
  attachments: ItemAttachment[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SendPlanAttachmentSuggestion {
  itemId: string;
  attachmentFilename?: string | null;
  reason?: string | null;
}

export interface SendPlanRecommendation {
  subject: string;
  body: string;
  recommendedContactId?: string | null;
  recommendedContactEmail?: string | null;
  contactReason?: string | null;
  attachments: SendPlanAttachmentSuggestion[];
  notes?: string | null;
  confidence?: number | null;
  suggestedSearchQuery?: string | null;
}

export interface SendPlanResponse {
  analysis: SendPlanAnalysis;
  prompt: string;
  searchQuery: string;
  contacts: SendPlanContact[];
  items: SendPlanItem[];
  recommendation: SendPlanRecommendation;
  generatedAt: string;
}

export interface SendExecuteAttachment {
  itemId: string;
  attachmentFilename?: string | null;
}

export interface ExecuteSendRequest {
  platforms: Array<'email' | 'xcom'>;
  subject?: string;
  body?: string;
  xcomPost?: string;
  contactId?: string | null;
  toEmail?: string | string[] | null;
  cc?: string[];
  bcc?: string[];
  replyTo?: string | null;
  attachments?: SendExecuteAttachment[];
  prompt?: string;
  recommendation?: SendPlanRecommendation;
  analysis?: SendPlanAnalysis;
}

export interface ExecuteSendResponse {
  success: boolean;
  sentAt: string;
  results?: {
    email?: { success: boolean; error?: string; itemId?: string };
    xcom?: { success: boolean; error?: string; tweetId?: string };
  };
  itemId?: string; // Deprecated: use results.email.itemId
  contact: SendPlanContact | null;
}

export interface SearchFilters {
  entities?: Array<'item' | 'contact'>;
  types?: string[];
  tags?: string[];
  sources?: string[];
  uploadedBy?: 'me' | 'shared' | 'all';
  dateFrom?: string;
  dateTo?: string;
  hasAttachments?: boolean;
  fileType?: string;
}

export interface ReceivedEmail {
  id: string;
  to: string[];
  from: string;
  created_at: string;
  subject: string;
  bcc?: string[];
  cc?: string[];
  reply_to?: string[];
  message_id?: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  id: string;
  filename: string;
  size: number;
  content_type: string;
  content_disposition?: string;
  content_id?: string | null;
  download_url?: string;
  expires_at?: string;
}

export interface ReceivedEmailListResponse {
  object: string;
  has_more: boolean;
  data: ReceivedEmail[];
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Normalize headers to a Record type for safe access
    const headers: Record<string, string> = {};

    // Convert existing headers to Record format
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }

    // Only set Content-Type if not already set and body is not FormData
    // FormData needs browser to set Content-Type with boundary
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const url = `${this.baseUrl}${endpoint}`;

    // Log the URL in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${options.method || 'GET'} ${url}`);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (error) {
      // Network error (e.g., server not reachable, CORS, network failure)
      const errorMessage = error instanceof Error ? error.message : 'Unknown network error';
      console.error(`[API] Network error for ${options.method || 'GET'} ${url}:`, errorMessage);
      throw new ApiError(
        `Failed to connect to API server. Please ensure the API server is running at ${this.baseUrl}. ${errorMessage}`,
        0,
        { originalError: errorMessage }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      let parsedError: unknown;
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        parsedError = null;
      }

      if (process.env.NODE_ENV === 'development') {
        console.error(`[API Error] ${url}:`, parsedError ?? errorText);
      }

      const errorData =
        typeof parsedError === 'object' && parsedError !== null
          ? (parsedError as Record<string, unknown>)
          : undefined;

      const fallbackMessage = `Request failed: ${response.status} ${response.statusText}`;
      const errorMessage =
        (errorData?.details as string | undefined) ||
        (errorData?.error as string | undefined) ||
        fallbackMessage;

      throw new ApiError(errorMessage, response.status, errorData);
    }

    return response.json();
  }

  // Auth
  async signup(data: {
    username: string;
    password: string;
    recovery_email: string;
    first_name: string;
    last_name: string;
    date_of_birth?: string;
    headline?: string;
    bio?: string;
    company?: string;
    project_title?: string;
    project_description?: string;
    zip_code?: string;
    x_profile_url?: string;
    youtube_url?: string;
    github_url?: string;
    linkedin_url?: string;
    referral_code?: string;
  }) {
    const response = await this.request<{ token: string; user: User }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async loginWithPassword(usernameOrEmail: string, password: string) {
    const response = await this.request<
      | { token: string; user: User }
      | { twoFactorRequired: true; pendingToken: string; user: User }
    >('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail, password }),
    });
    if ('token' in response && response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async getCurrentUser() {
    return this.request<{ user: User }>('/api/auth/me', { method: 'GET' });
  }

  async getApiKeyInfo(): Promise<{ hasKey: boolean; createdAt: string | null; lastUsedAt: string | null }> {
    return this.request<{ hasKey: boolean; createdAt: string | null; lastUsedAt: string | null }>('/api/auth/api-key', {
      method: 'GET',
    });
  }

  async createApiKey(): Promise<{ apiKey: string; createdAt: string | null; lastUsedAt: string | null }> {
    return this.request<{ apiKey: string; createdAt: string | null; lastUsedAt: string | null }>('/api/auth/api-key', {
      method: 'POST',
    });
  }

  async revokeApiKey(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/auth/api-key', { method: 'DELETE' });
  }

  async getTwoFactorStatus(): Promise<TwoFactorStatus> {
    return this.request<TwoFactorStatus>('/api/auth/2fa', { method: 'GET' });
  }

  async startTwoFactorSetup(): Promise<TwoFactorSetupResponse> {
    return this.request<TwoFactorSetupResponse>('/api/auth/2fa/setup', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async verifyTwoFactorSetup(code: string): Promise<TwoFactorVerifyResponse> {
    return this.request<TwoFactorVerifyResponse>('/api/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async completeTwoFactorChallenge(params: { pendingToken: string; code?: string; recoveryCode?: string }): Promise<TwoFactorChallengeResponse> {
    const response = await this.request<TwoFactorChallengeResponse>('/api/auth/2fa/challenge', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async disableTwoFactor(params: { code?: string; recoveryCode?: string }): Promise<TwoFactorDisableResponse> {
    return this.request<TwoFactorDisableResponse>('/api/auth/2fa', {
      method: 'DELETE',
      body: JSON.stringify(params),
    });
  }

  // Items
  async createItem(data: FormData): Promise<CreateItemResponse> {
    // Don't set Content-Type header - browser will set it automatically with boundary for FormData
    return this.request<CreateItemResponse>('/api/items', {
      method: 'POST',
      body: data,
    });
  }

  async importBookmarks(file: File): Promise<{ message: string; total: number; note: string; premium?: boolean }> {
    const formData = new FormData();
    formData.append('bookmarkFile', file);

    // Don't set Content-Type header - browser will set it automatically with boundary for FormData
    return this.request<{ message: string; total: number; note: string; premium?: boolean }>('/api/items/import-bookmarks', {
      method: 'POST',
      body: formData,
    });
  }

  async importContacts(file: File): Promise<ContactImportResponse> {
    const formData = new FormData();
    formData.append('contactsFile', file);

    return this.request<ContactImportResponse>('/api/contacts/import', {
      method: 'POST',
      body: formData,
    });
  }

  async createBookmarkImportPaymentIntent(bookmarkCount: number): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    amount: number;
    currency: string;
  }> {
    return this.request<{
      clientSecret: string;
      paymentIntentId: string;
      amount: number;
      currency: string;
    }>('/api/payment/bookmark-import', {
      method: 'POST',
      body: JSON.stringify({ bookmarkCount }),
    });
  }

  async createSubscriptionPaymentIntent(tier: SubscriptionTier): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    amount: number;
    currency: string;
    subscriptionTier: SubscriptionTier;
    plan: {
      name: string;
      billingInterval: 'month' | 'year';
      maxIndexedItems: number | null;
      amountCents: number;
    };
  }> {
    return this.request<{
      clientSecret: string;
      paymentIntentId: string;
      amount: number;
      currency: string;
      subscriptionTier: SubscriptionTier;
      plan: {
        name: string;
        billingInterval: 'month' | 'year';
        maxIndexedItems: number | null;
        amountCents: number;
      };
    }>('/api/payment/premium-subscription', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    });
  }

  async verifyPayment(paymentIntentId: string): Promise<{ verified: boolean; message: string; premium?: boolean; subscriptionTier?: SubscriptionTier }> {
    return this.request<{ verified: boolean; message: string; premium?: boolean; subscriptionTier?: SubscriptionTier }>('/api/payment/verify', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId }),
    });
  }

  async getContacts(limit: number = 50, offset: number = 0, search?: string): Promise<ContactListResponse> {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    if (offset > 0) {
      params.append('offset', String(offset));
    }
    if (search && search.trim().length > 0) {
      params.append('search', search.trim());
    }

    const query = params.toString();

    return this.request<ContactListResponse>(`/api/contacts${query ? `?${query}` : ''}`);
  }

  async getContactCount(search?: string): Promise<{ count: number }> {
    const params = new URLSearchParams();
    if (search && search.trim().length > 0) {
      params.append('search', search.trim());
    }

    const query = params.toString();
    return this.request<{ count: number }>(`/api/contacts/count${query ? `?${query}` : ''}`);
  }

  async createContact(payload: { firstName?: string | null; lastName?: string | null; first_name?: string | null; last_name?: string | null; name?: string | null; email?: string | null; phone?: string | null; linkedinUrl?: string | null; xUrl?: string | null; githubUrl?: string | null; metadata?: Record<string, unknown> | null; sourceItemId?: string | null }): Promise<Contact> {
    const body: Record<string, unknown> = {};
    if (payload.firstName !== undefined) body.first_name = payload.firstName;
    if (payload.lastName !== undefined) body.last_name = payload.lastName;
    if (payload.first_name !== undefined) body.first_name = payload.first_name;
    if (payload.last_name !== undefined) body.last_name = payload.last_name;
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.email !== undefined) body.email = payload.email;
    if (payload.phone !== undefined) body.phone = payload.phone;
    if (payload.linkedinUrl !== undefined) body.linkedin_url = payload.linkedinUrl;
    if (payload.xUrl !== undefined) body.x_url = payload.xUrl;
    if (payload.githubUrl !== undefined) body.github_url = payload.githubUrl;
    if (payload.metadata !== undefined) body.metadata = payload.metadata;
    if (payload.sourceItemId !== undefined) body.source_item_id = payload.sourceItemId;

    const response = await this.request<{ contact: Contact }>('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return response.contact;
  }

  async updateContact(contactId: string, payload: { firstName?: string | null; lastName?: string | null; first_name?: string | null; last_name?: string | null; name?: string | null; email?: string | null; phone?: string | null; linkedinUrl?: string | null; xUrl?: string | null; githubUrl?: string | null; metadata?: Record<string, unknown> | null }): Promise<Contact> {
    const body: Record<string, unknown> = {};
    if (payload.firstName !== undefined) body.first_name = payload.firstName;
    if (payload.lastName !== undefined) body.last_name = payload.lastName;
    if (payload.first_name !== undefined) body.first_name = payload.first_name;
    if (payload.last_name !== undefined) body.last_name = payload.last_name;
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.email !== undefined) body.email = payload.email;
    if (payload.phone !== undefined) body.phone = payload.phone;
    if (payload.linkedinUrl !== undefined) body.linkedin_url = payload.linkedinUrl;
    if (payload.xUrl !== undefined) body.x_url = payload.xUrl;
    if (payload.githubUrl !== undefined) body.github_url = payload.githubUrl;
    if (payload.metadata !== undefined) body.metadata = payload.metadata;

    const response = await this.request<{ contact: Contact }>(`/api/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    return response.contact;
  }

  async deleteContact(contactId: string): Promise<void> {
    await this.request(`/api/contacts/${contactId}`, {
      method: 'DELETE',
    });
  }

  async getItems(limit?: number, offset?: number, filters?: { source?: string; hasAttachments?: boolean; fileType?: string }): Promise<Item[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    if (filters?.source) params.append('source', filters.source);
    if (filters?.hasAttachments) params.append('hasAttachments', 'true');
    if (filters?.fileType) params.append('fileType', filters.fileType);
    return this.request<Item[]>(`/api/items?${params.toString()}`);
  }

  async getIndexedItemCount(
    filters?: { source?: string; hasAttachments?: boolean; fileType?: string }
  ): Promise<{
    count: number;
    filteredCount?: number;
    isAtLimit: boolean;
    isApproachingLimit: boolean;
    limit: number;
    subscriptionTier?: SubscriptionTier;
    planName?: string;
  }> {
    const params = new URLSearchParams();
    if (filters?.source) params.append('source', filters.source);
    if (filters?.hasAttachments) params.append('hasAttachments', 'true');
    if (filters?.fileType) params.append('fileType', filters.fileType);

    const query = params.toString();
    const endpoint = query ? `/api/items/count?${query}` : '/api/items/count';

    return this.request<{
      count: number;
      filteredCount?: number;
      isAtLimit: boolean;
      isApproachingLimit: boolean;
      limit: number;
      subscriptionTier?: SubscriptionTier;
      planName?: string;
    }>(endpoint);
  }

  async getItem(id: string): Promise<Item> {
    return this.request<Item>(`/api/items/${id}`);
  }

  async getItemMetadata(id: string): Promise<LinkMetadata> {
    return this.request<LinkMetadata>(`/api/items/${id}/metadata`);
  }

  async indexItem(id: string) {
    return this.request(`/api/items/${id}/index`, { method: 'POST' });
  }

  async updateItem(id: string, updates: { title?: string; description?: string; tags?: string[]; notes?: string }): Promise<Item> {
    return this.request<Item>(`/api/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async shareItemByEmail(id: string, email: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/items/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async postItemToProfile(itemId: string): Promise<Item> {
    return this.request<Item>(`/api/items/${itemId}/post-to-profile`, {
      method: 'POST',
    });
  }

  async removeItemFromProfile(itemId: string): Promise<Item> {
    return this.request<Item>(`/api/items/${itemId}/post-to-profile`, {
      method: 'DELETE',
    });
  }

  async getProfileItems(username: string, limit: number = 50, offset: number = 0): Promise<{ items: Item[] }> {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (offset > 0) {
      params.append('offset', offset.toString());
    }
    return this.request<{ items: Item[] }>(`/api/profiles/${encodeURIComponent(username)}/items?${params.toString()}`);
  }

  async updateItemNotes(id: string, notes: string): Promise<Item> {
    return this.request<Item>(`/api/items/${id}/notes`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    });
  }

  async deleteItem(id: string) {
    return this.request(`/api/items/${id}`, { method: 'DELETE' });
  }

  getFileUrl(itemId: string, filename: string, inline: boolean = false): string {
    const token = this.token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!token) {
      throw new Error('No authentication token available');
    }
    const url = `${this.baseUrl}/api/items/${itemId}/files/${encodeURIComponent(filename)}`;
    const params = new URLSearchParams();
    if (inline) {
      params.append('inline', 'true');
    }
    params.append('token', token);
    return `${url}?${params.toString()}`;
  }

  isImageMimetype(mimetype: string | undefined): boolean {
    return !!mimetype && mimetype.startsWith('image/');
  }

  async downloadFile(itemId: string, filename: string) {
    const token = this.token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    const url = `${this.baseUrl}/api/items/${itemId}/files/${encodeURIComponent(filename)}`;

    // Use fetch for file downloads to handle blob response
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Download failed' }));
      throw new Error(error.error || 'Download failed');
    }

    // Get blob from response
    const blob = await response.blob();

    // Create download link and trigger download
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;

    // Get filename from Content-Disposition header or use provided filename
    const contentDisposition = response.headers.get('Content-Disposition');
    let downloadFilename = filename;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch) {
        downloadFilename = decodeURIComponent(filenameMatch[1]);
      }
    }

    link.download = downloadFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }

  async downloadItemsExport(format: 'json' | 'csv' = 'json') {
    const token = this.token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!token) {
      throw new Error('No authentication token available');
    }

    const params = new URLSearchParams();
    if (format) {
      params.append('format', format);
    }

    const url = `${this.baseUrl}/api/items/export?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Export failed' }));
      throw new Error(error.error || 'Export failed');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;

    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = contentDisposition ? contentDisposition.match(/filename="?([^"]+)"?/)?.[1] : undefined;
    if (filename) {
      filename = decodeURIComponent(filename);
    } else {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `items-export-${timestamp}.${format}`;
    }

    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }

  isRemoteAttachment(attachment: ItemAttachment | null | undefined): boolean {
    return (
      !!attachment &&
      (Boolean(attachment.attachmentId) || Boolean(attachment.url) || Boolean(attachment.id))
    );
  }

  /**
   * Build a preview URL for an attachment.
   *
   * - For regular uploaded files (no `url` and no remote id), we use the
   *   authenticated `/api/items/:id/files/:filename` route.
   * - For remote email attachments (e.g. Resend), we route through our
   *   `/api/email/attachments/:itemId/:attachmentId` proxy, which handles
   *   authentication, access control, and streaming from the remote source.
   */
  getAttachmentPreviewUrl(
    itemId: string,
    attachment: ItemAttachment,
    inline: boolean = false
  ): string | null {
    const token =
      this.token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

    // If we don't have a token (e.g., public profile view), we cannot build
    // authenticated URLs. The UI should handle `null` and avoid broken images.
    if (!token) {
      return null;
    }

    // Remote attachments (typically inbound email attachments stored with a `url`)
    if (this.isRemoteAttachment(attachment)) {
      const attachmentId = attachment.attachmentId || attachment.id || attachment.filename;
      if (!attachmentId) {
        return null;
      }

      const url = `${this.baseUrl}/api/email/attachments/${encodeURIComponent(
        itemId
      )}/${encodeURIComponent(attachmentId)}`;
      const params = new URLSearchParams();
      if (inline) {
        params.append('inline', 'true');
      }
      params.append('token', token);
      return `${url}?${params.toString()}`;
    }

    // Fallback: locally stored file in our own storage
    try {
      if (!attachment.filename) {
        console.warn('[API] Attachment missing filename:', attachment);
        return null;
      }
      return this.getFileUrl(itemId, attachment.filename, inline);
    } catch (error) {
      console.warn('[API] Failed to get file URL:', error, attachment);
      return null;
    }
  }

  // Search
  async search(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      filters?: SearchFilters;
    }
  ): Promise<SearchResponse> {
    const params = new URLSearchParams();
    params.set('q', query);

    if (options?.limit && Number.isFinite(options.limit)) {
      params.set('limit', Math.max(1, Math.min(options.limit, 50)).toString());
    }

    if (options?.offset !== undefined && Number.isFinite(options.offset)) {
      params.set('offset', Math.max(0, options.offset).toString());
    }

    const filters = options?.filters;
    if (filters) {
      filters.entities?.forEach((value) => params.append('entity', value));
      filters.types?.forEach((value) => params.append('type', value));
      filters.tags?.forEach((value) => params.append('tag', value));
      filters.sources?.forEach((value) => params.append('source', value));

      if (filters.uploadedBy && filters.uploadedBy !== 'all') {
        params.set('uploadedBy', filters.uploadedBy);
      }

      if (typeof filters.hasAttachments === 'boolean' && filters.hasAttachments) {
        params.set('hasAttachments', 'true');
      }

      if (filters.dateFrom) {
        params.set('dateFrom', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.set('dateTo', filters.dateTo);
      }

      if (filters.fileType) {
        params.set('fileType', filters.fileType);
      }
    }

    return this.request<SearchResponse>(`/api/search?${params.toString()}`);
  }

  // Generate
  async generate(prompt: string, type: string, contextQuery?: string) {
    return this.request('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, type, contextQuery }),
    });
  }

  // Resend Emails
  async getReceivedEmails(limit?: number, after?: string, before?: string): Promise<ReceivedEmailListResponse> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (after) params.append('after', after);
    if (before) params.append('before', before);
    const queryString = params.toString();
    return this.request<ReceivedEmailListResponse>(`/api/email/received${queryString ? `?${queryString}` : ''}`);
  }

  async getReceivedEmail(emailId: string): Promise<ReceivedEmail> {
    return this.request<ReceivedEmail>(`/api/email/received/${emailId}`);
  }

  async getEmailAttachments(emailId: string): Promise<{ object: string; has_more: boolean; data: EmailAttachment[] }> {
    return this.request<{ object: string; has_more: boolean; data: EmailAttachment[] }>(`/api/email/received/${emailId}/attachments`);
  }

  async downloadEmailAttachment(emailId: string, attachmentId: string) {
    const token = this.token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    const url = `${this.baseUrl}/api/email/received/${emailId}/attachments/${attachmentId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Download failed' }));
      throw new Error(error.error || 'Download failed');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;

    const contentDisposition = response.headers.get('Content-Disposition');
    let downloadFilename = attachmentId;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch) {
        downloadFilename = decodeURIComponent(filenameMatch[1]);
      }
    }

    link.download = downloadFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }

  async generateEmailSummary(emailId: string): Promise<{ summary: string[] }> {
    return this.request<{ summary: string[] }>(`/api/email/received/${emailId}/summary`, {
      method: 'POST',
    });
  }

  async generateItemEmailSummary(itemId: string): Promise<{ summary: string[] }> {
    return this.request<{ summary: string[] }>(`/api/items/${itemId}/email-summary`, {
      method: 'POST',
    });
  }

  async markItemAsSpam(itemId: string): Promise<Item> {
    return this.request<Item>(`/api/items/${itemId}/mark-spam`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async unmarkItemAsSpam(itemId: string): Promise<Item> {
    return this.request<Item>(`/api/items/${itemId}/unmark-spam`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async planSend(prompt: string): Promise<SendPlanResponse> {
    return this.request<SendPlanResponse>('/api/send/plan', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  async executeSend(payload: ExecuteSendRequest): Promise<ExecuteSendResponse> {
    return this.request<ExecuteSendResponse>('/api/send/execute', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // X.com OAuth


  // Feedback
  async submitFeedback(data: { title: string; message: string; image?: File }): Promise<{ success: boolean; message: string }> {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('message', data.message);
    if (data.image) {
      formData.append('image', data.image);
    }

    return this.request<{ success: boolean; message: string }>('/api/feedback', {
      method: 'POST',
      body: formData,
    });
  }


  // Profiles
  async getPublicProfile(username: string): Promise<{ profile: PublicProfile }> {
    return this.request<{ profile: PublicProfile }>(`/api/profiles/${encodeURIComponent(username)}`, {
      method: 'GET',
    });
  }

  async getPublicUsernameByUserId(userId: string): Promise<{ username: string }> {
    return this.request<{ username: string }>(`/api/profiles/user/${encodeURIComponent(userId)}/username`, {
      method: 'GET',
    });
  }

  async getMyProfile(): Promise<{ profile: User }> {
    return this.request<{ profile: User }>('/api/profiles/me', {
      method: 'GET',
    });
  }

  async updateProfile(profileData: ProfileUpdateData): Promise<{ profile: User }> {
    const formData = new FormData();

    if (profileData.public_username !== undefined) {
      formData.append('public_username', profileData.public_username);
    }
    if (profileData.first_name !== undefined) {
      formData.append('first_name', profileData.first_name);
    }
    if (profileData.last_name !== undefined) {
      formData.append('last_name', profileData.last_name);
    }
    if (profileData.headline !== undefined) {
      formData.append('headline', profileData.headline);
    }
    if (profileData.bio !== undefined) {
      formData.append('bio', profileData.bio);
    }
    if (profileData.company !== undefined) {
      formData.append('company', profileData.company);
    }
    if (profileData.project_title !== undefined) {
      formData.append('project_title', profileData.project_title);
    }
    if (profileData.project_description !== undefined) {
      formData.append('project_description', profileData.project_description);
    }
    if (profileData.zip_code !== undefined) {
      formData.append('zip_code', profileData.zip_code);
    }
    if (profileData.x_profile_url !== undefined) {
      formData.append('x_profile_url', profileData.x_profile_url);
    }
    if (profileData.youtube_url !== undefined) {
      formData.append('youtube_url', profileData.youtube_url);
    }
    if (profileData.github_url !== undefined) {
      formData.append('github_url', profileData.github_url);
    }
    if (profileData.linkedin_url !== undefined) {
      formData.append('linkedin_url', profileData.linkedin_url);
    }
    if (profileData.avatar) {
      formData.append('avatar', profileData.avatar);
    }

    return this.request<{ profile: User }>('/api/profiles/me', {
      method: 'PUT',
      body: formData,
    });
  }

  async updateProfilePrivacy(isPrivate: boolean): Promise<{ profile: User }> {
    return this.request<{ profile: User }>('/api/profiles/me/privacy', {
      method: 'PUT',
      body: JSON.stringify({ profile_private: isPrivate }),
    });
  }

  // Login Sessions
  async getLoginSessions(limit?: number, offset?: number): Promise<{
    sessions: Array<{
      id: string;
      user_id: string;
      login_at: string;
      ip_address?: string | null;
      user_agent?: string | null;
      created_at: string;
    }>;
    pagination: {
      limit: number;
      offset: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return this.request<{
      sessions: Array<{
        id: string;
        user_id: string;
        login_at: string;
        ip_address?: string | null;
        user_agent?: string | null;
        created_at: string;
      }>;
      pagination: {
        limit: number;
        offset: number;
        total: number;
        hasMore: boolean;
      };
    }>(`/api/auth/login-sessions${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  async getLoginStreak(): Promise<{
    currentStreak: number;
    weekDays: number[];
  }> {
    return this.request<{
      currentStreak: number;
      weekDays: number[];
    }>('/api/auth/login-streak', {
      method: 'GET',
    });
  }

  // Collections
  async getCollections(): Promise<Collection[]> {
    return this.request<Collection[]>('/api/collections', {
      method: 'GET',
    });
  }

  async getCollection(id: string): Promise<Collection> {
    return this.request<Collection>(`/api/collections/${id}`, {
      method: 'GET',
    });
  }

  async createCollection(data: {
    title: string;
    description?: string;
    color?: string;
    icon?: string;
  }): Promise<Collection> {
    return this.request<Collection>('/api/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCollection(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      color?: string | null;
      icon?: string | null;
    }
  ): Promise<Collection> {
    return this.request<Collection>(`/api/collections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCollection(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/collections/${id}`, {
      method: 'DELETE',
    });
  }

  async getCollectionItems(
    collectionId: string,
    limit?: number,
    offset?: number
  ): Promise<Item[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return this.request<Item[]>(
      `/api/collections/${collectionId}/items${query ? `?${query}` : ''}`,
      {
        method: 'GET',
      }
    );
  }

  async addItemToCollection(
    collectionId: string,
    itemId: string
  ): Promise<{ message: string; addedCount: number; totalRequested: number }> {
    return this.request<{
      message: string;
      addedCount: number;
      totalRequested: number;
    }>(`/api/collections/${collectionId}/items`, {
      method: 'POST',
      body: JSON.stringify({ itemIds: [itemId] }),
    });
  }

  async addItemsToCollection(
    collectionId: string,
    itemIds: string[]
  ): Promise<{ message: string; addedCount: number; totalRequested: number }> {
    return this.request<{
      message: string;
      addedCount: number;
      totalRequested: number;
    }>(`/api/collections/${collectionId}/items`, {
      method: 'POST',
      body: JSON.stringify({ itemIds }),
    });
  }

  async removeItemFromCollection(
    collectionId: string,
    itemId: string
  ): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/api/collections/${collectionId}/items/${itemId}`,
      {
        method: 'DELETE',
      }
    );
  }

  // Collection sharing methods
  async postCollectionToProfile(id: string): Promise<Collection> {
    return this.request<Collection>(`/api/collections/${id}/post-to-profile`, {
      method: 'POST',
    });
  }

  async removeCollectionFromProfile(id: string): Promise<Collection> {
    return this.request<Collection>(`/api/collections/${id}/post-to-profile`, {
      method: 'DELETE',
    });
  }

  async updateCollectionSharing(
    id: string,
    isPubliclyShareable: boolean
  ): Promise<Collection> {
    return this.request<Collection>(`/api/collections/${id}/sharing`, {
      method: 'PATCH',
      body: JSON.stringify({ is_publicly_shareable: isPubliclyShareable }),
    });
  }

  async getCollectionShareToken(id: string): Promise<{ share_token: string | null }> {
    return this.request<{ share_token: string | null }>(`/api/collections/${id}/share-token`, {
      method: 'GET',
    });
  }

  async getPublicCollectionByToken(
    token: string,
    limit?: number,
    offset?: number
  ): Promise<Collection> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return this.request<Collection>(
      `/api/collections/shared/${token}${query ? `?${query}` : ''}`,
      {
        method: 'GET',
      }
    );
  }

  async getProfileCollections(
    username: string,
    limit?: number,
    offset?: number
  ): Promise<{ collections: Collection[] }> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return this.request<{ collections: Collection[] }>(
      `/api/profiles/${encodeURIComponent(username)}/collections${query ? `?${query}` : ''}`,
      {
        method: 'GET',
      }
    );
  }

  async getItemCollections(itemId: string): Promise<Collection[]> {
    return this.request<Collection[]>(`/api/items/${itemId}/collections`, {
      method: 'GET',
    });
  }

  // Slack integration methods
  async getSlackStatus(): Promise<{ connected: boolean; workspaceId: string | null; workspaceName: string | null }> {
    const status = await this.request<{ connected: boolean; workspaceName: string | null; workspaceId: string | null }>('/api/slack/status');
    return {
      connected: status.connected,
      workspaceId: status.workspaceId,
      workspaceName: status.workspaceName,
    };
  }

  async initiateSlackOAuth(): Promise<{ authUrl: string; state: string }> {
    return this.request('/api/slack/oauth/initiate', { method: 'POST' });
  }

  async disconnectSlack(): Promise<void> {
    return this.request('/api/slack/disconnect', { method: 'DELETE' });
  }

  async ingestSlackWorkspace(workspaceId: string): Promise<{ message: string }> {
    return this.request('/api/slack/ingest', {
      method: 'POST',
      body: JSON.stringify({ workspaceId }),
    });
  }

  async getSlackMessageContext(
    workspaceId: string,
    channelId: string,
    messageTs: string
  ): Promise<{
    message: any;
    thread: any[];
  }> {
    return this.request(`/api/slack/messages/${workspaceId}/${channelId}/${encodeURIComponent(messageTs)}/context`);
  }

  async getSlackMessages(
    workspaceId?: string,
    channelId?: string,
    limit?: number,
    offset?: number
  ): Promise<{
    messages: Array<{
      id: string;
      item: Item;
      slackMessage: {
        workspaceId: string;
        channelId: string;
        messageTs: string;
        threadTs: string | null;
        text: string | null;
      };
      channel: { name: string | null; type: string | null } | null;
      permalink: string;
    }>;
    total: number;
  }> {
    const params = new URLSearchParams();
    if (workspaceId) params.append('workspaceId', workspaceId);
    if (channelId) params.append('channelId', channelId);
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return this.request(`/api/slack/messages${query ? `?${query}` : ''}`);
  }

  // Referral
  async setReferralCode(code: string) {
    return this.request<{ success: boolean; referral_code: string | null }>('/api/referral/code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async getReferralCode() {
    return this.request<{ referral_code: string | null }>('/api/referral/code');
  }

  async getReferralStats() {
    return this.request<{
      referral_code: string | null;
      total_referrals: number;
      total_earnings_cents: number;
      pending_earnings_cents: number;
      has_connected_account: boolean;
    }>('/api/referral/stats');
  }

  async getReferralCommissions(limit?: number, offset?: number) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return this.request<{
      commissions: Array<{
        id: string;
        referral_id: string;
        payment_intent_id: string;
        amount_cents: number;
        status: 'pending' | 'paid' | 'failed';
        stripe_transfer_id: string | null;
        created_at: string;
        paid_at: string | null;
      }>;
      pagination: {
        limit: number;
        offset: number;
        has_more: boolean;
      };
    }>(`/api/referral/commissions${query ? `?${query}` : ''}`);
  }

  async setupStripeConnect() {
    return this.request<{
      onboarding_url: string;
      account_id: string;
    }>('/api/referral/connect/setup', {
      method: 'POST',
    });
  }

  async getStripeConnectStatus() {
    return this.request<{
      has_account: boolean;
      account_id?: string;
      details_submitted?: boolean;
      charges_enabled?: boolean;
      payouts_enabled?: boolean;
    }>('/api/referral/connect/status');
  }

}

export const apiClient = new ApiClient(API_URL);
