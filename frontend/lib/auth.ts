import { apiClient } from './api';

export interface User {
  id: string;
  email: string;
  verified: boolean;
  is_premium?: boolean;
}

let currentUser: User | null = null;
let authRestoring: Promise<void> | null = null;
let authRestored = false;

export const auth = {
  async login(email: string): Promise<void> {
    await apiClient.sendMagicLink(email);
  },

  async verify(token: string): Promise<User> {
    const response = await apiClient.verifyToken(token);
    currentUser = response.user;
    return response.user;
  },

  getUser(): User | null {
    return currentUser;
  },

  setUser(user: User | null) {
    currentUser = user;
  },

  logout() {
    currentUser = null;
    authRestored = false;
    apiClient.clearToken();
  },

  isAuthenticated(): boolean {
    return currentUser !== null;
  },

  /**
   * Restore authentication from stored token
   * Should be called on app initialization
   */
  async restore(): Promise<void> {
    if (authRestored) {
      return;
    }

    // If already restoring, wait for it
    if (authRestoring) {
      return authRestoring;
    }

    // Check if token exists
    if (typeof window === 'undefined') {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      authRestored = true;
      return;
    }

    // Restore auth
    authRestoring = (async () => {
      try {
        const response = await apiClient.getCurrentUser();
        if (response.user) {
          currentUser = response.user;
          authRestored = true;
        }
      } catch (error) {
        // Token is invalid or expired, clear it
        console.error('Failed to restore auth:', error);
        localStorage.removeItem('token');
        currentUser = null;
        authRestored = true;
      } finally {
        authRestoring = null;
      }
    })();

    return authRestoring;
  },

  /**
   * Wait for auth restoration to complete
   */
  async waitForRestore(): Promise<void> {
    if (authRestoring) {
      await authRestoring;
    }
  },
};
