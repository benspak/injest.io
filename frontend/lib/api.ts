const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5555';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
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
    const headers: HeadersInit = { ...options.headers };

    // Only set Content-Type if not already set and body is not FormData
    // FormData needs browser to set Content-Type with boundary
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
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

  async getItems(limit?: number, offset?: number) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    return this.request(`/api/items?${params.toString()}`);
  }

  async getItem(id: string) {
    return this.request(`/api/items/${id}`);
  }

  async getItemMetadata(id: string) {
    return this.request(`/api/items/${id}/metadata`);
  }

  async indexItem(id: string) {
    return this.request(`/api/items/${id}/index`, { method: 'POST' });
  }

  async updateItem(id: string, updates: { title?: string; description?: string; tags?: string[]; notes?: string }) {
    return this.request(`/api/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async updateItemNotes(id: string, notes: string) {
    return this.request(`/api/items/${id}/notes`, {
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
  async search(query: string) {
    return this.request(`/api/search?q=${encodeURIComponent(query)}`);
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
