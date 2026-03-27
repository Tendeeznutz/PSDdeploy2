import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Customer } from './types';

interface AuthState {
  customer: Customer | null;
  isAuthenticated: boolean;
  login: (customer: Customer) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      customer: null,
      isAuthenticated: false,
      login: (customer) => {
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
        set({ customer: null, isAuthenticated: false });
      },
    }),
    {
      name: 'customer-storage',
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Old format had full customer object - strip to minimal fields
          if (persistedState.customer) {
            persistedState.customer = {
              id: persistedState.customer.id,
              customerName: persistedState.customer.customerName,
            };
          }
        }
        return persistedState;
      },
      partialize: (state) => ({
        customer: state.customer ? { id: state.customer.id, customerName: state.customer.customerName } : null,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
