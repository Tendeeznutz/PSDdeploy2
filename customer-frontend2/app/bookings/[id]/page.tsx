'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StatusBadge from '@/components/StatusBadge';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import { appointmentApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { mockAppointments } from '@/lib/mockData';
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
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_STEPS = [
  { id: '1', label: 'Requested', icon: AlertCircle },
  { id: '2', label: 'Confirmed', icon: CheckCircle },
  { id: '3', label: 'Assigned', icon: User },
  { id: '4', label: 'On The Way', icon: MapPin },
  { id: '5', label: 'In Service', icon: Package },
  { id: '6', label: 'Completed', icon: CheckCircle },
];

function BookingDetailsContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { customer, isAuthenticated } = useAuthStore();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadAppointment();
    
    // Check for success parameter
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true);
      // Remove success param from URL
      router.replace(`/bookings/${params.id}`, { scroll: false });
    }
  }, [params.id, searchParams]);

  const loadAppointment = async () => {
    try {
      setLoading(true);
      const isMockUser = customer?.id === 'mock-customer-id-123' || customer?.customerEmail === 'test@hotmail.com';
      
      if (isMockUser) {
        const mockAppt = mockAppointments.find(a => a.id === params.id);
        if (mockAppt) {
          setAppointment(mockAppt);
        }
      } else {
        const data = await appointmentApi.getAppointment(params.id as string);
        setAppointment(data);
      }
    } catch (error) {
      console.error('Failed to load appointment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      alert('Please provide a cancellation reason');
      return;
    }

    if (!appointment) return;

    try {
      setCancelling(true);
      await appointmentApi.cancelAppointment(appointment.id, cancelReason);
      await loadAppointment();
      setShowCancelModal(false);
      setCancelReason('');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to cancel appointment');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="pt-24 pb-16 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="pt-24 pb-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Appointment not found</h1>
          <Link href="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp * 1000), 'MMMM d, yyyy');
  };

  const formatTime = (timestamp: number) => {
    return format(new Date(timestamp * 1000), 'h:mm a');
  };

  const getCurrentStatusIndex = () => {
    const status = appointment.appointmentStatus;
    // Map backend status to timeline steps
    // '1' = Pending/Requested -> Step 0 (Requested)
    // '2' = Confirmed -> Step 1 (Confirmed)
    // '3' = Completed -> Step 5 (Completed)
    // '4' = Cancelled -> -1 (don't show timeline)
    if (status === '1') return 0; // Requested
    if (status === '2') {
      // If technician assigned, show step 2, otherwise step 1
      return appointment.technician ? 2 : 1; // Assigned or Confirmed
    }
    if (status === '3') return 5; // Completed
    if (status === '4') return -1; // Cancelled
    return 0;
  };

  const canCancel = appointment.appointmentStatus === '1' || appointment.appointmentStatus === '2';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="text-primary-600 hover:text-primary-700 mb-6 inline-block">
            ← Back to Dashboard
          </Link>

          {showSuccess && (
            <div className="mb-6 p-6 bg-green-50 border-2 border-green-200 rounded-lg">
              <div className="flex items-start">
                <CheckCircle className="w-6 h-6 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-900 mb-1">Booking Confirmed!</h3>
                  <p className="text-green-800">
                    Your appointment has been successfully booked. You'll receive a confirmation email shortly.
                  </p>
                </div>
                <button
                  onClick={() => setShowSuccess(false)}
                  className="text-green-600 hover:text-green-700 ml-4"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm p-6 md:p-8 mb-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Booking #{appointment.id.slice(0, 8).toUpperCase()}
                </h1>
                <StatusBadge status={appointment.appointmentStatus} />
              </div>
              <div className="flex gap-2">
                {canCancel && (
                  <>
                    <Link href={`/bookings/${appointment.id}/edit`}>
                      <Button variant="outline">
                        Reschedule
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() => setShowCancelModal(true)}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Cancel Booking
                    </Button>
                  </>
                )}
                <Link href="/support">
                  <Button variant="outline">
                    Contact Support
                  </Button>
                </Link>
              </div>
            </div>

            {/* Status Timeline */}
            {appointment.appointmentStatus !== '4' && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4">Status Timeline</h2>
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  <div className="space-y-6">
                    {STATUS_STEPS.map((step, index) => {
                      const Icon = step.icon;
                      const currentIndex = getCurrentStatusIndex();
                      const isCompleted = index < currentIndex;
                      const isActive = index === currentIndex;
                      const isUpcoming = index > currentIndex;
                      
                      return (
                        <div key={step.id} className="relative flex items-start">
                          <div
                            className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                              isActive
                                ? 'bg-primary-600 text-white ring-2 ring-primary-200'
                                : isCompleted
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-200 text-gray-400'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="ml-4 flex-1">
                            <p
                              className={`font-medium ${
                                isActive ? 'text-primary-600' : isCompleted ? 'text-gray-900' : 'text-gray-500'
                              }`}
                            >
                              {step.label}
                            </p>
                            {isActive && (
                              <p className="text-xs text-primary-600 mt-1">Current status</p>
                            )}
                            {isCompleted && (
                              <p className="text-xs text-gray-500 mt-1">Completed</p>
                            )}
                            {isUpcoming && (
                              <p className="text-xs text-gray-400 mt-1">Upcoming</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Booking Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-primary-600" />
                  Schedule
                </h3>
                <p className="text-sm text-gray-600">
                  {formatDate(appointment.appointmentStartTime)}
                </p>
                <p className="text-sm text-gray-600">
                  {formatTime(appointment.appointmentStartTime)} - {formatTime(appointment.appointmentEndTime)}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-primary-600" />
                  Address
                </h3>
                <p className="text-sm text-gray-600">
                  {appointment.customer?.customerAddress || 'N/A'}
                </p>
                <p className="text-sm text-gray-600">
                  Singapore {appointment.customer?.customerPostalCode || ''}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3 flex items-center">
                  <Package className="w-5 h-5 mr-2 text-primary-600" />
                  Service Details
                </h3>
                <p className="text-sm text-gray-600">
                  {appointment.airconDevices?.length || appointment.airconToService?.length || 0} unit(s)
                </p>
                {appointment.airconDevices && appointment.airconDevices.length > 0 && (
                  <ul className="text-sm text-gray-600 mt-2">
                    {appointment.airconDevices.map((device) => (
                      <li key={device.id}>• {device.airconName}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-primary-600" />
                  Payment
                </h3>
                <p className="text-sm text-gray-600 capitalize">
                  Method: {appointment.paymentMethod.replace('_', ' ')}
                </p>
              </div>
            </div>

            {/* Actions */}
            {canCancel && (
              <div className="flex gap-3 mb-6">
                <Link href={`/bookings/${appointment.id}/edit`} className="flex-1">
                  <Button variant="outline" className="w-full">
                    Reschedule
                  </Button>
                </Link>
                <Link href="/support" className="flex-1">
                  <Button variant="outline" className="w-full">
                    Contact Support
                  </Button>
                </Link>
              </div>
            )}

            {/* Technician Info */}
            {appointment.technician && (
              <div className="bg-primary-50 p-6 rounded-lg border border-primary-200">
                <h3 className="font-semibold mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2 text-primary-600" />
                  Assigned Technician
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Name</p>
                    <p className="font-medium">{appointment.technician.technicianName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Phone</p>
                    <p className="font-medium">{appointment.technician.technicianPhone}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Cancellation Info */}
            {appointment.appointmentStatus === '4' && appointment.cancellationReason && (
              <div className="bg-red-50 p-6 rounded-lg border border-red-200 mt-6">
                <h3 className="font-semibold text-red-900 mb-2">Cancellation Details</h3>
                <p className="text-sm text-red-800">
                  <span className="font-medium">Reason:</span> {appointment.cancellationReason}
                </p>
                {appointment.cancelledBy && (
                  <p className="text-sm text-red-800 mt-2">
                    <span className="font-medium">Cancelled by:</span> {appointment.cancelledBy}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setCancelReason('');
        }}
        title="Cancel Booking"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to cancel this booking? Please provide a reason for cancellation.
          </p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
            rows={4}
            placeholder="Enter cancellation reason..."
          />
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelModal(false);
                setCancelReason('');
              }}
            >
              Keep Booking
            </Button>
            <Button
              variant="secondary"
              onClick={handleCancel}
              isLoading={cancelling}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Booking
            </Button>
          </div>
        </div>
      </Modal>

      <Footer />
    </div>
  );
}

export default function BookingDetailsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="pt-24 pb-16 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
        <Footer />
      </div>
    }>
      <BookingDetailsContent />
    </Suspense>
  );
}
