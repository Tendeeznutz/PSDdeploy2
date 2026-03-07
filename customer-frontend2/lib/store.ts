import { create } from 'zustand';
import type { Customer, Appointment } from './types';

interface AuthState {
  customer: Customer | null;
  isAuthenticated: boolean;
  login: (customer: Customer) => void;
  logout: () => void;
}

interface BookingState {
  currentBooking: Partial<Appointment> | null;
  setCurrentBooking: (booking: Partial<Appointment> | null) => void;
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
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('customer');
    }
    set({ customer: null, isAuthenticated: false });
  },
}));

export const useBookingStore = create<BookingState>((set) => ({
  currentBooking: null,
  setCurrentBooking: (booking) => set({ currentBooking: booking }),
}));
