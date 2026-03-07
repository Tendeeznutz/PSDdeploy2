'use client';

import { useState } from 'react';
import Link from 'next/link';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import Button from './Button';
import type { Appointment } from '@/lib/types';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  User, 
  Package,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';

interface BookingDetailsModalProps {
  appointment: Appointment;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_STEPS = [
  { id: '1', label: 'Requested', icon: AlertCircle },
  { id: '2', label: 'Confirmed', icon: CheckCircle },
  { id: '3', label: 'Assigned', icon: User },
  { id: '4', label: 'On The Way', icon: MapPin },
  { id: '5', label: 'In Service', icon: Package },
  { id: '6', label: 'Completed', icon: CheckCircle },
];

export default function BookingDetailsModal({ appointment, isOpen, onClose }: BookingDetailsModalProps) {
  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp * 1000), 'MMM d, yyyy');
  };

  const formatTime = (timestamp: number) => {
    return format(new Date(timestamp * 1000), 'h:mm a');
  };

  const getStatusStep = (status: string) => {
    switch (status) {
      case '1': return 0; // Requested
      case '2': return 1; // Confirmed
      case '3': return 2; // Assigned (if technician assigned, show step 2)
      case '4': return 3; // Cancelled
      default: return 0;
    }
  };

  const currentStep = getStatusStep(appointment.appointmentStatus);
  const isCompleted = appointment.appointmentStatus === '3';
  const isCancelled = appointment.appointmentStatus === '4';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Booking Details" size="lg">
      <div className="space-y-6">
        {/* Booking ID & Status */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Booking #{appointment.id.slice(0, 8).toUpperCase()}
            </h3>
            <StatusBadge status={appointment.appointmentStatus} />
          </div>
        </div>

        {/* Status Timeline */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Status Timeline</h4>
          <div className="space-y-3">
            {STATUS_STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index <= currentStep && !isCancelled;
              const isCurrent = index === currentStep && !isCancelled;
              
              return (
                <div key={step.id} className="flex items-start space-x-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-400'
                  }`}>
                    <StepIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 pt-1">
                    <p className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                      {step.label}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-primary-600 mt-1">Current status</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Booking Information */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Booking Information</h4>
          
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex items-start space-x-3">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-gray-600">Date & Time</p>
                <p className="font-medium text-gray-900">
                  {formatDate(appointment.appointmentStartTime)} at {formatTime(appointment.appointmentStartTime)}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-gray-600">Service Address</p>
                <p className="font-medium text-gray-900">
                  {appointment.customer?.customerAddress || 'Address not available'}
                </p>
                {appointment.customer?.customerPostalCode && (
                  <p className="text-gray-600">Singapore {appointment.customer.customerPostalCode}</p>
                )}
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Package className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-gray-600">Units</p>
                <p className="font-medium text-gray-900">
                  {appointment.airconDevices?.length || appointment.airconToService?.length || 0} unit(s)
                </p>
              </div>
            </div>

            {appointment.technician && (
              <div className="flex items-start space-x-3">
                <User className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-gray-600">Technician</p>
                  <p className="font-medium text-gray-900">{appointment.technician.technicianName}</p>
                  {appointment.technician.technicianPhone && (
                    <div className="flex items-center space-x-2 mt-1">
                      <Phone className="w-3 h-3 text-gray-400" />
                      <a 
                        href={`tel:${appointment.technician.technicianPhone}`}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        {appointment.technician.technicianPhone}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-start space-x-3">
              <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-gray-600">Payment Method</p>
                <p className="font-medium text-gray-900 capitalize">
                  {appointment.paymentMethod === 'card' ? 'Credit/Debit Card' : 
                   appointment.paymentMethod === 'paynow' ? 'PayLah/PayNow' :
                   appointment.paymentMethod === 'bank_transfer' ? 'Bank Transfer' :
                   appointment.paymentMethod || 'Cash'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cancellation Reason */}
        {isCancelled && appointment.cancellationReason && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-red-900 mb-1">Cancellation Reason</p>
            <p className="text-sm text-red-800">{appointment.cancellationReason}</p>
          </div>
        )}

        {/* Customer Feedback */}
        {isCompleted && appointment.customerFeedback && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-green-900 mb-1">Your Feedback</p>
            <p className="text-sm text-green-800">{appointment.customerFeedback}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Link href={`/bookings/${appointment.id}`} className="flex-1">
            <Button variant="outline" className="w-full">
              View Full Details
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          {!isCancelled && !isCompleted && (
            <Link href={`/bookings/${appointment.id}/edit`} className="flex-1">
              <Button variant="outline" className="w-full">
                Reschedule
              </Button>
            </Link>
          )}
        </div>
      </div>
    </Modal>
  );
}
