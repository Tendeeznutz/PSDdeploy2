// API Types based on Django backend models

export interface Customer {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerPostalCode: string;
  customerLocation?: string;
  created_at?: string;
}

export interface CustomerAirconDevice {
  id: string;
  customerId: string;
  airconName: string;
  numberOfUnits: number;
  airconType: 'industrial' | 'split' | 'window' | 'centralized' | 'floor_mounted' | 'portable';
  lastServiceMonth?: string;
  remarks?: string | null;
}

export interface Technician {
  id: string;
  technicianName: string;
  technicianPhone: string;
  technicianAddress?: string;
  technicianPostalCode?: string;
  technicianLocation?: string;
  technicianStatus: '1' | '2'; // Available | Unavailable
}

export type AppointmentStatus = '1' | '2' | '3' | '4'; // Pending | Confirmed | Completed | Cancelled

export type PaymentMethod = 'cash' | 'cheque' | 'card' | 'bank_transfer' | 'paynow';

// Shape returned by the backend's format_response `display` dict
export interface AppointmentDisplay {
  appointmentStatus?: string;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerPostalCode?: string;
  customerRating?: number;
  customerRatingCount?: number;
  technicianName?: string;
  technicianPhone?: string;
  technicianPostalCode?: string;
  technicianAddress?: string;
  technicianRating?: number;
  technicianRatingCount?: number;
  airconToService?: string[];
  airconBrand?: string[];
  airconModel?: string[];
  airconType?: string[];
  hasRatedTechnician?: boolean;
  hasRatedCustomer?: boolean;
}

export interface Appointment {
  id: string;
  customerId: string;
  technicianId?: string;
  appointmentStartTime: number; // Unix timestamp
  appointmentEndTime: number; // Unix timestamp
  airconToService: string[]; // Array of CustomerAirconDevice IDs
  appointmentStatus: AppointmentStatus;
  paymentMethod: PaymentMethod;
  customerFeedback?: string | null;
  cancellationReason?: string | null;
  cancelledBy?: string;
  cancelledAt?: string;
  // Normalized from backend display dict
  customer?: Partial<Customer>;
  technician?: Partial<Technician> | null;
  airconDevices?: CustomerAirconDevice[];
  // Raw backend display data (used by some components directly)
  display?: AppointmentDisplay;
}

export interface ServiceOption {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  pricePerUnit: number;
  icon: string;
}

export interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface TimeSlot {
  time: string;
  label: string;
}

export interface BookingFormData {
  // Step 1: Service Selection
  serviceType: string;
  airconDevices: string[]; // Selected device IDs
  addOns: string[];

  // Step 2: Address & Details
  address: string;
  postalCode: string;
  notes?: string;

  // Step 3: Schedule
  date: Date | null;
  timeSlot: string;

  // Step 4: Contact
  name: string;
  email: string;
  phone: string;
  isLoggedIn: boolean;

  // Step 5: Payment
  paymentMethod: PaymentMethod;
}

export interface AuthResponse {
  customer_id: string;
  customerName: string;
  role: 'customer';
}
