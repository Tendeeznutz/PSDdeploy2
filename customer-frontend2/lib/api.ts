import axios from 'axios';
import type {
  Customer,
  Appointment,
  AppointmentDisplay,
  CustomerAirconDevice,
  BookingFormData,
  AuthResponse
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

/**
 * Normalize a raw backend appointment response into the shape the frontend expects.
 * The backend returns related data under a flat `display` dict; the frontend reads
 * `appointment.customer.*` and `appointment.technician.*` as nested objects.
 */
function normalizeAppointment(raw: Record<string, unknown>): Appointment {
  const display = (raw.display || {}) as AppointmentDisplay;

  // Build nested customer object from display fields
  const customer: Partial<Customer> | undefined =
    display.customerName
      ? {
          customerName: display.customerName,
          customerPhone: display.customerPhone ?? '',
          customerEmail: display.customerEmail ?? '',
          customerAddress: display.customerAddress ?? '',
          customerPostalCode: display.customerPostalCode ?? '',
        }
      : (raw.customer as Partial<Customer> | undefined);

  // Build nested technician object from display fields
  const technician: Partial<import('./types').Technician> | null | undefined =
    display.technicianName
      ? {
          technicianName: display.technicianName,
          technicianPhone: display.technicianPhone ?? '',
          technicianAddress: display.technicianAddress,
          technicianPostalCode: display.technicianPostalCode,
        }
      : (raw.technician as Partial<import('./types').Technician> | null | undefined);

  return {
    ...(raw as unknown as Appointment),
    customer,
    technician: technician ?? null,
    display,
  };
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Handle 401 by attempting cookie-based token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await api.post('/token/refresh/');
        return api(originalRequest);
      } catch {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('customer-storage');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// Customer API
export const customerApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/customers/login/', { email, password });
    return response.data;
  },

  register: async (data: {
    customerName: string;
    customerEmail: string;
    customerPassword: string;
    customerPhone: string;
    customerAddress: string;
    customerPostalCode: string;
  }): Promise<Customer> => {
    const response = await api.post('/customers/', data);
    return response.data;
  },

  getProfile: async (customerId: string): Promise<Customer> => {
    const response = await api.get(`/customers/${customerId}/`);
    return response.data;
  },

  updateProfile: async (customerId: string, data: Partial<Customer> & Record<string, unknown>): Promise<Customer> => {
    const response = await api.patch(`/customers/${customerId}/`, data);
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await api.post('/customers/forgot-password/', { email });
    return response.data;
  },

  validateResetToken: async (token: string) => {
    const response = await api.post('/customers/validate-reset-token/', { token });
    return response.data;
  },

  resetPassword: async (token: string, newPassword: string) => {
    const response = await api.post('/customers/reset-password/', { token, newPassword });
    return response.data;
  },
};

// Aircon Devices API
export const airconDeviceApi = {
  getDevices: async (customerId: string): Promise<CustomerAirconDevice[]> => {
    const response = await api.get('/customeraircondevices/', {
      params: { customerId },
    });
    return response.data;
  },

  createDevice: async (data: Omit<CustomerAirconDevice, 'id'>): Promise<CustomerAirconDevice> => {
    const response = await api.post('/customeraircondevices/', data);
    return response.data;
  },

  updateDevice: async (deviceId: string, data: Partial<CustomerAirconDevice>): Promise<CustomerAirconDevice> => {
    const response = await api.patch(`/customeraircondevices/${deviceId}/`, data);
    return response.data;
  },

  deleteDevice: async (deviceId: string): Promise<void> => {
    await api.delete(`/customeraircondevices/${deviceId}/`);
  },
};

// Messages API
export const messageApi = {
  getInbox: async (recipientId: string, recipientType: string = 'customer'): Promise<any[]> => {
    const response = await api.get('/messages/inbox/', {
      params: { recipientId, recipientType },
    });
    return response.data;
  },

  getSent: async (senderId: string, senderType: string = 'customer'): Promise<any[]> => {
    const response = await api.get('/messages/sent/', {
      params: { senderId, senderType },
    });
    return response.data;
  },

  getUnreadCount: async (recipientId: string, recipientType: string = 'customer'): Promise<number> => {
    const response = await api.get('/messages/unread-count/', {
      params: { recipientId, recipientType },
    });
    return response.data.unreadCount || 0;
  },

  markAsRead: async (messageId: string): Promise<void> => {
    await api.patch(`/messages/${messageId}/mark-read/`);
  },

  sendMessage: async (data: {
    senderId: string;
    senderType: string;
    senderName: string;
    subject: string;
    body: string;
  }): Promise<any> => {
    const response = await api.post('/messages/', data);
    return response.data;
  },
};

// Appointments API
export const appointmentApi = {
  getAppointments: async (customerId: string): Promise<Appointment[]> => {
    const response = await api.get('/appointments/', {
      params: { customerId },
    });
    const data = Array.isArray(response.data) ? response.data : [];
    return data.map(normalizeAppointment);
  },

  getAppointment: async (appointmentId: string): Promise<Appointment> => {
    const response = await api.get(`/appointments/${appointmentId}/`);
    return normalizeAppointment(response.data);
  },

  createAppointment: async (data: {
    customerId: string;
    appointmentStartTime: number;
    appointmentEndTime: number;
    airconToService: string[];
    paymentMethod: string;
  }): Promise<Appointment> => {
    const response = await api.post('/appointments/', data);
    return normalizeAppointment(response.data);
  },

  updateAppointment: async (
    appointmentId: string,
    data: Partial<Appointment>
  ): Promise<Appointment> => {
    const response = await api.patch(`/appointments/${appointmentId}/`, data);
    return normalizeAppointment(response.data);
  },

  cancelAppointment: async (
    appointmentId: string,
    cancellationReason: string
  ): Promise<Appointment> => {
    const response = await api.patch(`/appointments/${appointmentId}/`, {
      appointmentStatus: '4',
      cancellationReason,
      cancelledBy: 'customer',
    });
    return normalizeAppointment(response.data);
  },

  getUnavailableSlots: async (customerId: string): Promise<{
    nearby_technicians: any[];
    unavailable_timeslots: number[];
  }> => {
    const response = await api.get('/appointments/unavailable/', {
      params: { customerId },
    });
    return response.data;
  },

  getUnratedCompleted: async (customerId: string) => {
    const response = await api.get(`/appointments/unrated-completed/?customerId=${customerId}`);
    const data = Array.isArray(response.data) ? response.data : [];
    return data.map(normalizeAppointment);
  },

  rateTechnician: async (appointmentId: string, data: { rating: number; customerId: string }) => {
    const response = await api.post(`/appointments/${appointmentId}/rate-technician/`, data);
    return response.data;
  },

  getPenaltyStatus: async (customerId: string) => {
    const response = await api.get('/appointments/penalty-status/', { params: { customerId } });
    return response.data;
  },
};

// Telegram API
export const telegramApi = {
  generateLink: async (userId: string): Promise<{ token: string; deepLink: string; expiresAt: string }> => {
    const response = await api.post('/telegram/generate-link/', {
      userType: 'customer',
      userId,
    });
    return response.data;
  },

  checkStatus: async (userId: string): Promise<{ linked: boolean }> => {
    const response = await api.get('/telegram/status/', {
      params: { userType: 'customer', userId },
    });
    return response.data;
  },

  unlink: async (userId: string): Promise<void> => {
    await api.post('/telegram/unlink/', {
      userType: 'customer',
      userId,
    });
  },
};

// Auth API
export const authApi = {
  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout/');
    } catch {
      // Server unreachable — still clear local state
    }
  },
};

// Helper function to convert booking form to API format
export const convertBookingToApiFormat = (
  formData: BookingFormData,
  customerId: string
): {
  customerId: string;
  appointmentStartTime: number;
  appointmentEndTime: number;
  airconToService: string[];
  paymentMethod: string;
} => {
  // Calculate start time from date and time slot (clone to avoid mutating the original)
  const date = new Date(formData.date!.getTime());
  const [hours, minutes] = formData.timeSlot.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  const appointmentStartTime = Math.floor(date.getTime() / 1000);

  // Calculate end time (1 hour per aircon unit)
  const numUnits = formData.airconDevices.length;
  const appointmentEndTime = appointmentStartTime + (numUnits * 3600);

  return {
    customerId,
    appointmentStartTime,
    appointmentEndTime,
    airconToService: formData.airconDevices,
    paymentMethod: formData.paymentMethod,
  };
};

export default api;
