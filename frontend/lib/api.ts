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

const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5555');

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

export interface Item {
  id: string;
  owner_id: string;
  type?: 'note' | 'link' | 'file' | 'email' | 'task';
  raw?: string;
  title?: string;
  description?: string;
  url?: string;
  attachments?: Array<{
    filename: string;
    originalname: string;
    mimetype?: string;
    size?: number;
    attachmentId?: string;
  }>;
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

export interface User {
  id: string;
  email: string;
  verified: boolean;
  is_premium?: boolean;
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

export interface SearchResult {
  item: Item;
  similarity: number;
  source?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
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

      const errorObject =
        typeof parsedError === 'object' && parsedError !== null
          ? (parsedError as { error?: string; details?: string })
          : undefined;

      const fallbackMessage = `Request failed: ${response.status} ${response.statusText}`;
      const errorMessage = errorObject?.details || errorObject?.error || fallbackMessage;
      throw new Error(errorMessage);
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
    const response = await this.request<{ token: string; user: User }>(
      `/api/auth/verify?token=${token}`,
      { method: 'GET' }
    );
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async getCurrentUser() {
    return this.request<{ user: User }>('/api/auth/me', { method: 'GET' });
  }

  // Items
  async createItem(data: FormData): Promise<Item | {
    batch: boolean;
    total: number;
    created: number;
    failed: number;
    items?: Item[];
    errors?: Array<{ filename: string; error: string }>;
  }> {
    // Don't set Content-Type header - browser will set it automatically with boundary for FormData
    return this.request<Item | {
      batch: boolean;
      total: number;
      created: number;
      failed: number;
      items?: Item[];
      errors?: Array<{ filename: string; error: string }>;
    }>('/api/items', {
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

  async createPremiumSubscriptionPaymentIntent(): Promise<{
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
    }>('/api/payment/premium-subscription', {
      method: 'POST',
    });
  }

  async verifyPayment(paymentIntentId: string): Promise<{ verified: boolean; message: string; premium?: boolean }> {
    return this.request<{ verified: boolean; message: string; premium?: boolean }>('/api/payment/verify', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId }),
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

  async getIndexedItemCount(): Promise<{ count: number; isAtLimit?: boolean; isApproachingLimit?: boolean; limit?: number | null }> {
    return this.request<{ count: number; isAtLimit?: boolean; isApproachingLimit?: boolean; limit?: number | null }>('/api/items/count');
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

  // Search
  async search(query: string): Promise<SearchResponse> {
    return this.request<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`);
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

  // X.com OAuth
  async initiateXComAuth(): Promise<void> {
    // Make authenticated request to get auth URL, then redirect
    try {
      const response = await this.request<{ authUrl: string }>('/api/xcom/auth?format=json');
      if (response.authUrl) {
        window.location.href = response.authUrl;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error: unknown) {
      console.error('Error initiating X.com auth:', error);
      throw error instanceof Error ? error : new Error('Failed to initiate X.com auth');
    }
  }

  async getXComStatus(): Promise<{ connected: boolean; username?: string; user_id?: string }> {
    return this.request<{ connected: boolean; username?: string; user_id?: string }>('/api/xcom/status', {
      method: 'GET',
    });
  }

  async disconnectXCom(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/xcom/disconnect', {
      method: 'POST',
    });
  }

  // X.com Posting
  async postToXCom(image: File, description: string): Promise<{ success: boolean; postId: string; text: string }> {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('description', description);

    // Don't set Content-Type header - browser will set it automatically with boundary for FormData
    return this.request<{ success: boolean; postId: string; text: string }>('/api/xcom/post', {
      method: 'POST',
      body: formData,
    });
  }

  // X.com Account Linking
  async linkXComAccount(linkId: string, email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/auth/xcom/link', {
      method: 'POST',
      body: JSON.stringify({ linkId, email }),
    });
  }

  async createAccountWithXCom(linkId: string): Promise<{ token: string }> {
    return this.request<{ token: string }>('/api/auth/xcom/create-account', {
      method: 'POST',
      body: JSON.stringify({ linkId }),
    });
  }
}

export const apiClient = new ApiClient(API_URL);
