import { apiClient } from './api';
import type { User } from './api';

let currentUser: User | null = null;
let authRestoring: Promise<void> | null = null;
let authRestored = false;
let pendingTwoFactor: {
  pendingToken: string;
  user: User;
} | null = null;

export const auth = {
  async signup(signupData: {
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
  }): Promise<{ user: User; twoFactorRequired: boolean }> {
    const response = await apiClient.signup(signupData);

    pendingTwoFactor = null;
    currentUser = response.user;
    return { user: response.user, twoFactorRequired: false };
  },

  async loginWithPassword(usernameOrEmail: string, password: string): Promise<{ user: User; twoFactorRequired: boolean }> {
    const response = await apiClient.loginWithPassword(usernameOrEmail, password);

    if ('twoFactorRequired' in response && response.twoFactorRequired) {
      pendingTwoFactor = {
        pendingToken: response.pendingToken,
        user: response.user,
      };
      currentUser = null;
      return { user: response.user, twoFactorRequired: true };
    }

    pendingTwoFactor = null;
    currentUser = response.user;
    return { user: response.user, twoFactorRequired: false };
  },

  getUser(): User | null {
    return currentUser;
  },

  setUser(user: User | null) {
    currentUser = user;
  },

  hasPendingTwoFactor(): boolean {
    return pendingTwoFactor !== null;
  },

  getPendingTwoFactorUser(): User | null {
    return pendingTwoFactor?.user ?? null;
  },

  getPendingTwoFactorToken(): string | null {
    return pendingTwoFactor?.pendingToken ?? null;
  },

  clearPendingTwoFactor() {
    pendingTwoFactor = null;
  },

  async completeTwoFactorChallenge(params: { code?: string; recoveryCode?: string }): Promise<{
    user: User;
    recoveryCodeUsed: boolean;
    recoveryCodesRemaining: number;
  }> {
    if (!pendingTwoFactor) {
      throw new Error('No pending two-factor challenge');
    }

    const response = await apiClient.completeTwoFactorChallenge({
      pendingToken: pendingTwoFactor.pendingToken,
      code: params.code,
      recoveryCode: params.recoveryCode,
    });

    currentUser = response.user;
    pendingTwoFactor = null;
    return {
      user: response.user,
      recoveryCodeUsed: response.recoveryCodeUsed,
      recoveryCodesRemaining: response.recoveryCodesRemaining,
    };
  },

  logout() {
    currentUser = null;
    authRestored = false;
    apiClient.clearToken();
    pendingTwoFactor = null;
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
          pendingTwoFactor = null;
        }
      } catch (error) {
        // Token is invalid or expired, clear it
        console.error('Failed to restore auth:', error);
        localStorage.removeItem('token');
        currentUser = null;
        authRestored = true;
        pendingTwoFactor = null;
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
