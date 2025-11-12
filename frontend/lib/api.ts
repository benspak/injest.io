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
}

export interface Item {
  id: string;
  owner_id: string;
  type?: 'note' | 'link' | 'file' | 'email' | 'task';
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
  created_at: string;
  updated_at: string;
  // Flag to indicate if this is a Resend email (not in database)
  isResendEmail?: boolean;
  resendEmailId?: string;
}

export interface Contact {
  id: string;
  owner_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source_item_id: string | null;
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
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Task {
  id: string;
  item_id: string;
  title?: string | null;
  description?: string | null;
  status: TaskStatus;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
  item?: Item;
}

export interface TaskifyResponse {
  task: Task;
  item?: Item;
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
  followUpTasks?: string[] | null;
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
  subject: string;
  body: string;
  contactId?: string | null;
  toEmail?: string | null;
  cc?: string[];
  bcc?: string[];
  replyTo?: string | null;
  attachments?: SendExecuteAttachment[];
  prompt?: string;
  recommendation?: SendPlanRecommendation;
}

export interface ExecuteSendResponse {
  success: boolean;
  sentAt: string;
  itemId: string;
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

    const response = await fetch(url, {
      ...options,
      headers,
    });

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
  async sendMagicLink(email: string) {
    return this.request('/api/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyToken(token: string) {
    const response = await this.request<
      | { token: string; user: User }
      | { twoFactorRequired: true; pendingToken: string; user: User }
    >(
      `/api/auth/verify?token=${token}`,
      { method: 'GET' }
    );
    if ('token' in response && response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async getCurrentUser() {
    return this.request<{ user: User }>('/api/auth/me', { method: 'GET' });
  }

  async getOpenApiSpec(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/openapi.json', { method: 'GET' });
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
      maxIndexedItems: number;
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
        maxIndexedItems: number;
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

  async createContact(payload: { name?: string | null; email?: string | null; phone?: string | null; metadata?: Record<string, unknown> | null; sourceItemId?: string | null }): Promise<Contact> {
    const body: Record<string, unknown> = {};
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.email !== undefined) body.email = payload.email;
    if (payload.phone !== undefined) body.phone = payload.phone;
    if (payload.metadata !== undefined) body.metadata = payload.metadata;
    if (payload.sourceItemId !== undefined) body.source_item_id = payload.sourceItemId;

    const response = await this.request<{ contact: Contact }>('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return response.contact;
  }

  async updateContact(contactId: string, payload: { name?: string | null; email?: string | null; phone?: string | null; metadata?: Record<string, unknown> | null }): Promise<Contact> {
    const body: Record<string, unknown> = {};
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.email !== undefined) body.email = payload.email;
    if (payload.phone !== undefined) body.phone = payload.phone;
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

  getAttachmentPreviewUrl(itemId: string, attachment: ItemAttachment, inline: boolean = false): string {
    if (this.isRemoteAttachment(attachment)) {
      if (attachment.url) {
        return attachment.url;
      }

      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[API] Remote attachment "${attachment.originalname}" is missing a preview URL; falling back to stored file route.`
        );
      }
    }

    return this.getFileUrl(itemId, attachment.filename, inline);
  }

  // Search
  async search(
    query: string,
    options?: {
      limit?: number;
      filters?: SearchFilters;
    }
  ): Promise<SearchResponse> {
    const params = new URLSearchParams();
    params.set('q', query);

    if (options?.limit && Number.isFinite(options.limit)) {
      params.set('limit', Math.max(1, Math.min(options.limit, 50)).toString());
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

  // Tasks
  async taskifyItem(itemId: string, dueDate?: string): Promise<TaskifyResponse> {
    const payload: Record<string, unknown> = {};
    if (dueDate) {
      payload.due_date = dueDate;
    }

    return this.request<TaskifyResponse>(`/api/tasks/taskify/${itemId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getTasks(status?: TaskStatus): Promise<Task[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<Task[]>(`/api/tasks${query}`);
  }

  async updateTask(
    id: string,
    updates: { title?: string; description?: string; status?: TaskStatus; due_date?: string | null }
  ): Promise<Task> {
    return this.request<Task>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

}

export const apiClient = new ApiClient(API_URL);
