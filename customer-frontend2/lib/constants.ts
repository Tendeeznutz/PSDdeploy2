import type { ServiceOption, AddOn } from './types';

export const SERVICES: ServiceOption[] = [
  {
    id: 'general',
    name: 'General Servicing',
    description: 'Standard cleaning and maintenance',
    basePrice: 0,
    pricePerUnit: 50,
    icon: '🔧',
  },
  {
    id: 'chemical',
    name: 'Chemical Wash',
    description: 'Deep cleaning with chemical treatment',
    basePrice: 0,
    pricePerUnit: 80,
    icon: '🧪',
  },
  {
    id: 'troubleshooting',
    name: 'Troubleshooting',
    description: 'Diagnosis and repair services',
    basePrice: 50,
    pricePerUnit: 0,
    icon: '🔍',
  },
  {
    id: 'installation',
    name: 'Installation',
    description: 'New aircon unit installation',
    basePrice: 150,
    pricePerUnit: 0,
    icon: '⚙️',
  },
  {
    id: 'gas-topup',
    name: 'Gas Top-up',
    description: 'Refrigerant gas refill',
    basePrice: 80,
    pricePerUnit: 0,
    icon: '💨',
  },
];

export const ADD_ONS: AddOn[] = [
  {
    id: 'filter-replacement',
    name: 'Filter Replacement',
    description: 'Replace aircon filters',
    price: 30,
  },
  {
    id: 'extended-warranty',
    name: 'Extended Warranty',
    description: '3 months extended warranty',
    price: 50,
  },
  {
    id: 'priority-service',
    name: 'Priority Service',
    description: 'Faster response time',
    price: 20,
  },
];

export const TRAVEL_FEE = 10;

export const TIME_SLOTS = [
  { time: '09:00', label: '9:00 AM' },
  { time: '10:00', label: '10:00 AM' },
  { time: '11:00', label: '11:00 AM' },
  { time: '12:00', label: '12:00 PM' },
  { time: '13:00', label: '1:00 PM' },
  { time: '14:00', label: '2:00 PM' },
  { time: '15:00', label: '3:00 PM' },
  { time: '16:00', label: '4:00 PM' },
  { time: '17:00', label: '5:00 PM' },
];

export const STATUS_LABELS: Record<string, string> = {
  '1': 'Pending',
  '2': 'Confirmed',
  '3': 'Completed',
  '4': 'Cancelled',
};

export const STATUS_COLORS: Record<string, string> = {
  '1': 'bg-yellow-100 text-yellow-800',
  '2': 'bg-blue-100 text-blue-800',
  '3': 'bg-green-100 text-green-800',
  '4': 'bg-red-100 text-red-800',
};

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Credit/Debit Card' },
  { value: 'paynow', label: 'PayLah/PayNow' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];
