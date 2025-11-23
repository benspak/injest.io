import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_URL, ApiClientError} from '../config/api';
import type {
  User,
  Item,
  Collection,
  SearchResponse,
  LoginResponse,
  TwoFactorResponse,
} from './types';

const TOKEN_KEY = '@injest:token';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  private async loadToken() {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      this.token = token;
    } catch (error) {
      console.error('Failed to load token:', error);
    }
  }

  async setToken(token: string) {
    this.token = token;
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.error('Failed to save token:', error);
    }
  }

  async clearToken() {
    this.token = null;
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.error('Failed to clear token:', error);
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Remove Content-Type for FormData
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: unknown;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = {error: errorText};
        }

        throw new ApiClientError(
          (errorData as {error?: string})?.error || 'Request failed',
          response.status,
          errorData,
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }
      throw new ApiClientError(
        error instanceof Error ? error.message : 'Network error',
        0,
      );
    }
  }

  // Auth
  async login(
    usernameOrEmail: string,
    password: string,
  ): Promise<LoginResponse | TwoFactorResponse> {
    return this.request<LoginResponse | TwoFactorResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({usernameOrEmail, password}),
    });
  }

  async signup(data: {
    username: string;
    password: string;
    recovery_email: string;
    first_name: string;
    last_name: string;
  }): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.token) {
      await this.setToken(response.token);
    }
    return response;
  }

  async getCurrentUser(): Promise<{user: User}> {
    return this.request<{user: User}>('/api/auth/me');
  }

  async logout() {
    await this.clearToken();
  }

  // Items
  async getItems(limit = 50, offset = 0): Promise<Item[]> {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    return this.request<Item[]>(`/api/items?${params.toString()}`);
  }

  async getItem(id: string): Promise<Item> {
    return this.request<Item>(`/api/items/${id}`);
  }

  async createItem(data: FormData): Promise<Item> {
    return this.request<Item>('/api/items', {
      method: 'POST',
      body: data,
    });
  }

  async updateItem(
    id: string,
    updates: {title?: string; description?: string; tags?: string[]},
  ): Promise<Item> {
    return this.request<Item>(`/api/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteItem(id: string): Promise<void> {
    await this.request(`/api/items/${id}`, {method: 'DELETE'});
  }

  // Search
  async search(
    query: string,
    limit = 20,
    offset = 0,
  ): Promise<SearchResponse> {
    const params = new URLSearchParams();
    params.set('q', query);
    params.set('limit', limit.toString());
    params.set('offset', offset.toString());
    return this.request<SearchResponse>(`/api/search?${params.toString()}`);
  }

  // Collections
  async getCollections(): Promise<Collection[]> {
    return this.request<Collection[]>('/api/collections');
  }

  async getCollection(id: string): Promise<Collection> {
    return this.request<Collection>(`/api/collections/${id}`);
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

  async getCollectionItems(
    collectionId: string,
    limit = 50,
    offset = 0,
  ): Promise<Item[]> {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    return this.request<Item[]>(
      `/api/collections/${collectionId}/items?${params.toString()}`,
    );
  }

  async addItemToCollection(
    collectionId: string,
    itemId: string,
  ): Promise<{message: string}> {
    return this.request<{message: string}>(
      `/api/collections/${collectionId}/items`,
      {
        method: 'POST',
        body: JSON.stringify({itemIds: [itemId]}),
      },
    );
  }
}

export const apiClient = new ApiClient(API_URL);
