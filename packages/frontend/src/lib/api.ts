const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface Item {
  id: string;
  ownerId: string;
  type: 'note' | 'link' | 'file' | 'email' | 'task' | 'chat';
  raw: string;
  clean?: string;
  title?: string;
  tags?: string[];
  source?: {
    app?: string;
    url?: string;
    metadata?: Record<string, unknown>;
  };
  isTask?: boolean;
  taskCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('brain_token', token);
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('brain_token');
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

  // Auth
  async googleAuth(data: { email: string; name?: string; avatar?: string; googleId?: string }) {
    const result = await this.request<{ token: string; user: User }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(result.token);
    return result;
  }

  async magicLink(email: string) {
    return this.request<{ message: string; link?: string }>('/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // Items
  async createItem(data: { raw: string; type?: string; source?: any }): Promise<Item> {
    return this.request<Item>('/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getItems(params?: { limit?: number; offset?: number; type?: string; isTask?: boolean }): Promise<Item[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.type) query.set('type', params.type);
    if (params?.isTask) query.set('isTask', 'true');

    return this.request<Item[]>(`/items?${query.toString()}`);
  }

  async searchItems(query: string): Promise<any[]> {
    return this.request<any[]>('/items/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  async taskifyItem(id: string): Promise<Item> {
    return this.request<Item>(`/items/${id}/taskify`, {
      method: 'POST',
    });
  }

  async toggleTask(id: string, completed: boolean): Promise<Item> {
    return this.request<Item>(`/items/${id}/task`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    });
  }

  async generate(prompt: string, contextItemIds?: string[]): Promise<{ response: string }> {
    return this.request<{ response: string }>('/items/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, contextItemIds }),
    });
  }

  async deleteItem(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/items/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
