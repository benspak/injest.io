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
  type?: 'note' | 'link' | 'file' | 'email';
  raw?: string;
  title?: string;
  description?: string;
  url?: string;
  attachments?: any[];
  clean?: string;
  tags?: string[];
  source?: string;
  embedding_id?: string;
  link_metadata?: any;
  notes?: string;
  created_at: string;
  updated_at: string;
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
      let error: any;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: `Request failed: ${response.status} ${response.statusText}` };
      }

      // Log error details in development
      if (process.env.NODE_ENV === 'development') {
        console.error(`[API Error] ${url}:`, error);
      }

      throw new Error(error.error || `Request failed: ${response.status} ${response.statusText}`);
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
    const response = await this.request<{ token: string; user: any }>(
      `/api/auth/verify?token=${token}`,
      { method: 'GET' }
    );
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async getCurrentUser() {
    return this.request<{ user: any }>('/api/auth/me', { method: 'GET' });
  }

  // Items
  async createItem(data: FormData) {
    // Don't set Content-Type header - browser will set it automatically with boundary for FormData
    return this.request('/api/items', {
      method: 'POST',
      body: data,
    });
  }

  async getItems(limit?: number, offset?: number): Promise<Item[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    return this.request<Item[]>(`/api/items?${params.toString()}`);
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
}

export const apiClient = new ApiClient(API_URL);
