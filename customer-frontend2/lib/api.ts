import axios from 'axios';
import type { 
  Customer, 
  Appointment, 
  CustomerAirconDevice, 
  BookingFormData,
  AuthResponse 
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Customer API
export const customerApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/customers/login', { email, password });
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
    const response = await api.post('/customers', data);
    return response.data;
  },

  getProfile: async (customerId: string): Promise<Customer> => {
    const response = await api.get(`/customers/${customerId}`);
    return response.data;
  },

  updateProfile: async (customerId: string, data: Partial<Customer>): Promise<Customer> => {
    const response = await api.patch(`/customers/${customerId}`, data);
    return response.data;
  },
};

// Aircon Devices API
export const airconDeviceApi = {
  getDevices: async (customerId: string): Promise<CustomerAirconDevice[]> => {
    const response = await api.get('/customeraircondevices', {
      params: { customerId },
    });
    return response.data;
  },

  createDevice: async (data: Omit<CustomerAirconDevice, 'id'>): Promise<CustomerAirconDevice> => {
    const response = await api.post('/customeraircondevices', data);
    return response.data;
  },

  updateDevice: async (deviceId: string, data: Partial<CustomerAirconDevice>): Promise<CustomerAirconDevice> => {
    const response = await api.patch(`/customeraircondevices/${deviceId}`, data);
    return response.data;
  },

  deleteDevice: async (deviceId: string): Promise<void> => {
    await api.delete(`/customeraircondevices/${deviceId}`);
  },
};

// Messages API
export const messageApi = {
  getInbox: async (recipientId: string, recipientType: string = 'customer'): Promise<any[]> => {
    const response = await api.get('/messages/inbox', {
      params: { recipientId, recipientType },
    });
    return response.data;
  },

  getSent: async (senderId: string, senderType: string = 'customer'): Promise<any[]> => {
    const response = await api.get('/messages/sent', {
      params: { senderId, senderType },
    });
    return response.data;
  },

  getUnreadCount: async (recipientId: string, recipientType: string = 'customer'): Promise<number> => {
    const response = await api.get('/messages/unread-count', {
      params: { recipientId, recipientType },
    });
    return response.data.unreadCount || 0;
  },

  markAsRead: async (messageId: string): Promise<void> => {
    await api.patch(`/messages/${messageId}/mark-read`);
  },

  sendMessage: async (data: {
    senderId: string;
    senderType: string;
    senderName: string;
    subject: string;
    body: string;
  }): Promise<any> => {
    const response = await api.post('/messages', data);
    return response.data;
  },
};

// Appointments API
export const appointmentApi = {
  getAppointments: async (customerId: string): Promise<Appointment[]> => {
    const response = await api.get('/appointments', {
      params: { customerId },
    });
    return response.data;
  },

  getAppointment: async (appointmentId: string): Promise<Appointment> => {
    const response = await api.get(`/appointments/${appointmentId}`);
    return response.data;
  },

  createAppointment: async (data: {
    customerId: string;
    appointmentStartTime: number;
    appointmentEndTime: number;
    airconToService: string[];
    paymentMethod: string;
  }): Promise<Appointment> => {
    const response = await api.post('/appointments', data);
    return response.data;
  },

  updateAppointment: async (
    appointmentId: string,
    data: Partial<Appointment>
  ): Promise<Appointment> => {
    const response = await api.patch(`/appointments/${appointmentId}`, data);
    return response.data;
  },

  cancelAppointment: async (
    appointmentId: string,
    cancellationReason: string
  ): Promise<Appointment> => {
    const response = await api.patch(`/appointments/${appointmentId}`, {
      appointmentStatus: '4',
      cancellationReason,
      cancelledBy: 'customer',
    });
    return response.data;
  },

  getUnavailableSlots: async (customerId: string): Promise<{
    nearby_technicians: any[];
    unavailable_timeslots: number[];
  }> => {
    const response = await api.get('/appointments/unavailable', {
      params: { customerId },
    });
    return response.data;
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
  // Calculate start time from date and time slot
  const date = formData.date!;
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
