const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface Item {
  id: string;
  type: 'note' | 'link' | 'file' | 'email';
  raw: string;
  clean?: string;
  tags?: string[];
  source?: any;
  isTask: boolean;
  createdAt: string;
}

export interface SearchResult extends Item {
  similarity: number;
}

export interface User {
  id: string;
  email: string;
  name?: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async getMe(): Promise<{ user: User }> {
    return this.request('/api/auth/me');
  }

  async createItem(data: {
    type: 'note' | 'link' | 'file' | 'email';
    raw: string;
    source?: { app?: string; url?: string };
  }): Promise<{ item: Item }> {
    return this.request('/api/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listItems(params?: { limit?: number; offset?: number; isTask?: boolean }): Promise<{ items: Item[] }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.isTask) query.set('isTask', 'true');

    return this.request(`/api/items?${query.toString()}`);
  }

  async search(query: string): Promise<{ results: SearchResult[] }> {
    return this.request('/api/items/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  async taskify(itemId: string): Promise<{ item: Item }> {
    return this.request(`/api/items/${itemId}/taskify`, {
      method: 'POST',
    });
  }

  async generate(prompt: string, contextItemIds?: string[]): Promise<{ response: string; contextCount: number }> {
    return this.request('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, contextItemIds }),
    });
  }
}

export const api = new ApiClient();
