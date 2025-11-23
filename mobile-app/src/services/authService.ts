import {apiClient} from '../api/client';
import type {User} from '../api/types';

class AuthService {
  private currentUser: User | null = null;

  async login(usernameOrEmail: string, password: string) {
    const response = await apiClient.login(usernameOrEmail, password);

    if ('twoFactorRequired' in response) {
      return response;
    }

    if (response.token) {
      await apiClient.setToken(response.token);
      this.currentUser = response.user;
    }

    return response;
  }

  async signup(data: {
    username: string;
    password: string;
    recovery_email: string;
    first_name: string;
    last_name: string;
  }) {
    const response = await apiClient.signup(data);
    if (response.token) {
      this.currentUser = response.user;
    }
    return response;
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await apiClient.getCurrentUser();
      this.currentUser = response.user;
      return response.user;
    } catch (error) {
      this.currentUser = null;
      return null;
    }
  }

  async logout() {
    await apiClient.logout();
    this.currentUser = null;
  }

  getUser(): User | null {
    return this.currentUser;
  }

  setUser(user: User) {
    this.currentUser = user;
  }
}

export const authService = new AuthService();
