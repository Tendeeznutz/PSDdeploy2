import { create } from 'zustand';
import type { Customer } from './types';

interface AuthState {
  customer: Customer | null;
  isAuthenticated: boolean;
  login: (customer: Customer) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  customer: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('customer') || 'null') : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('customer') : false,
  login: (customer) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('customer', JSON.stringify(customer));
    }
    set({ customer, isAuthenticated: true });
  },
  logout: async () => {
    // Call server to blacklist refresh token cookie
    try {
      const { authApi } = await import('./api');
      await authApi.logout();
    } catch {
      // Continue with local cleanup even if server unreachable
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('customer');
    }
    set({ customer: null, isAuthenticated: false });
  },
}));
