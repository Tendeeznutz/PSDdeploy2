// Mock data for frontend development without backend
import type { Customer, CustomerAirconDevice, Appointment } from './types';

export const mockCustomer: Customer = {
  id: 'mock-customer-id-123',
  customerName: 'Test User',
  customerEmail: 'test@hotmail.com',
  customerPhone: '91234567',
  customerAddress: '123 Test Street',
  customerPostalCode: '123456',
  customerLocation: '1.3000,103.8000',
  created_at: new Date().toISOString(),
};

export const mockAirconDevices: CustomerAirconDevice[] = [
  {
    id: 'device-1',
    customerId: 'mock-customer-id-123',
    airconName: 'Living Room Unit',
    airconType: 'split',
    numberOfUnits: 1,
    lastServiceMonth: '2024-12',
    remarks: 'Works well, needs regular cleaning',
  },
  {
    id: 'device-2',
    customerId: 'mock-customer-id-123',
    airconName: 'Master Bedroom',
    airconType: 'split',
    numberOfUnits: 1,
    lastServiceMonth: '2024-11',
    remarks: null,
  },
  {
    id: 'device-3',
    customerId: 'mock-customer-id-123',
    airconName: 'Guest Room',
    airconType: 'window',
    numberOfUnits: 1,
    lastServiceMonth: null,
    remarks: 'Newly installed',
  },
];

export const mockAppointments: Appointment[] = [
  {
    id: 'appt-1',
    customerId: 'mock-customer-id-123',
    appointmentStartTime: Math.floor(new Date('2025-02-15T10:00:00').getTime() / 1000),
    appointmentEndTime: Math.floor(new Date('2025-02-15T11:00:00').getTime() / 1000),
    appointmentStatus: '2', // Confirmed
    paymentMethod: 'card',
    airconToService: ['device-1'],
    airconDevices: [mockAirconDevices[0]],
    customer: mockCustomer,
    technician: {
      id: 'tech-1',
      technicianName: 'John Technician',
      technicianPhone: '91234567',
      technicianStatus: '1',
    },
    customerFeedback: null,
    cancellationReason: null,
  },
  {
    id: 'appt-2',
    customerId: 'mock-customer-id-123',
    appointmentStartTime: Math.floor(new Date('2025-01-20T14:00:00').getTime() / 1000),
    appointmentEndTime: Math.floor(new Date('2025-01-20T15:00:00').getTime() / 1000),
    appointmentStatus: '3', // Completed
    paymentMethod: 'cash',
    airconToService: ['device-2'],
    airconDevices: [mockAirconDevices[1]],
    customer: mockCustomer,
    technician: {
      id: 'tech-1',
      technicianName: 'John Technician',
      technicianPhone: '91234567',
      technicianStatus: '1',
    },
    customerFeedback: 'Great service! Very professional.',
    cancellationReason: null,
  },
  {
    id: 'appt-3',
    customerId: 'mock-customer-id-123',
    appointmentStartTime: Math.floor(new Date('2025-01-10T09:00:00').getTime() / 1000),
    appointmentEndTime: Math.floor(new Date('2025-01-10T10:00:00').getTime() / 1000),
    appointmentStatus: '4', // Cancelled
    paymentMethod: 'card',
    airconToService: ['device-3'],
    airconDevices: [mockAirconDevices[2]],
    customer: mockCustomer,
    technician: null,
    customerFeedback: null,
    cancellationReason: 'Schedule conflict',
  },
];

export const mockMessages = [
  {
    id: 'msg-1',
    senderId: 'coordinator-1',
    senderType: 'coordinator',
    senderName: 'Admin Coordinator',
    recipientId: 'mock-customer-id-123',
    recipientType: 'customer',
    recipientName: 'Test User',
    subject: 'Appointment Confirmed',
    body: 'Your appointment on February 15, 2025 at 10:00 AM has been confirmed. Our technician will arrive on time.',
    isRead: false,
    created_at: new Date('2025-01-25T10:00:00').toISOString(),
    relatedAppointment: 'appt-1',
  },
  {
    id: 'msg-2',
    senderId: 'tech-1',
    senderType: 'technician',
    senderName: 'John Technician',
    recipientId: 'mock-customer-id-123',
    recipientType: 'customer',
    recipientName: 'Test User',
    subject: 'Service Completed',
    body: 'Thank you for choosing AirServe! Your aircon service has been completed. Please rate your experience.',
    isRead: true,
    created_at: new Date('2025-01-20T15:30:00').toISOString(),
    relatedAppointment: 'appt-2',
  },
];
