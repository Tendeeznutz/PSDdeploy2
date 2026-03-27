'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Button from '@/components/Button';
import dynamic from 'next/dynamic';

const Modal = dynamic(() => import('@/components/Modal'));
import { appointmentApi } from '@/lib/api';
import { APP_CONFIG } from '@/lib/config';
import { useAuthStore } from '@/lib/store';

import { TIME_SLOTS } from '@/lib/constants';
import type { Appointment } from '@/lib/types';
import { Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

// Travel buffer between appointments in seconds (30 minutes)
// Service time is already included in appointment end times (1hr per AC unit)
const UNAVAILABLE_BUFFER = 1800;

function RescheduleContent() {
  const router = useRouter();
  const params = useParams();
  const { customer, isAuthenticated } = useAuthStore();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [unavailableSlots, setUnavailableSlots] = useState<number[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadAppointment();
    generateAvailableDates();
  }, [params.id]);

  const loadAppointment = async () => {
    try {
      setLoading(true);
      const data = await appointmentApi.getAppointment(params.id as string);
      setAppointment(data);
      setSelectedDate(new Date(data.appointmentStartTime * 1000));
      setSelectedTimeSlot(format(new Date(data.appointmentStartTime * 1000), 'HH:mm'));
    } catch (error) {
      console.error('Failed to load appointment:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAvailableDates = () => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      if (date.getDay() !== 0) dates.push(date);
    }
    setAvailableDates(dates);
  };

  // Fetch unavailable slots when the selected date changes
  useEffect(() => {
    if (!selectedDate || !customer) {
      setUnavailableSlots([]);
      return;
    }

    const fetchUnavailableSlots = async () => {
      setSlotsLoading(true);
      setSlotsError(false);
      try {
        const data = await appointmentApi.getUnavailableSlots(customer.id);
        // Filter out the current appointment's own timeslot so it doesn't block itself
        const filtered = (data.unavailable_timeslots || []).filter((ts: number) => {
          if (!appointment) return true;
          return ts !== appointment.appointmentStartTime;
        });
        setUnavailableSlots(filtered);
      } catch (err) {
        console.error('Failed to fetch unavailable slots:', err);
        setSlotsError(true);
        setUnavailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };

    fetchUnavailableSlots();
  }, [selectedDate, customer, appointment]);

  // Clear time slot if it becomes unavailable after date change
  useEffect(() => {
    if (!selectedDate || !selectedTimeSlot) return;
    if (isSlotUnavailable(selectedTimeSlot)) {
      setSelectedTimeSlot('');
    }
  }, [unavailableSlots, selectedDate]);

  const isSlotUnavailable = (slotTime: string): boolean => {
    if (!selectedDate || unavailableSlots.length === 0) return false;

    const [hours, minutes] = slotTime.split(':').map(Number);
    const slotDate = new Date(selectedDate);
    slotDate.setHours(hours, minutes, 0, 0);
    const slotTimestamp = Math.floor(slotDate.getTime() / 1000);

    return unavailableSlots.some((unavailableTime) => {
      const blockStart = unavailableTime - UNAVAILABLE_BUFFER;
      const blockEnd = unavailableTime + UNAVAILABLE_BUFFER;
      return slotTimestamp >= blockStart && slotTimestamp <= blockEnd;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTimeSlot || !appointment) return;

    setSubmitting(true);

    try {
      const [hours, minutes] = selectedTimeSlot.split(':').map(Number);
      selectedDate.setHours(hours, minutes, 0, 0);
      const newStartTime = Math.floor(selectedDate.getTime() / 1000);
      const duration = appointment.appointmentEndTime - appointment.appointmentStartTime;

      await appointmentApi.updateAppointment(appointment.id, {
        appointmentStartTime: newStartTime,
        appointmentEndTime: newStartTime + duration,
      } as any);

      setShowSuccess(true);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reschedule appointment');
    } finally {
      setSubmitting(false);
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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Appointment not found</h1>
          <Link href="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const appointmentDate = new Date(appointment.appointmentStartTime * 1000);
  const hoursUntilAppointment = (appointmentDate.getTime() - new Date().getTime()) / (1000 * 60 * 60);
  const canRescheduleNow = hoursUntilAppointment >= 24;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Link href={`/bookings/${appointment.id}`} className="text-primary-600 hover:text-primary-700 mb-4 inline-block">
              ← Back to Booking Details
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Reschedule Appointment</h1>
            <p className="text-gray-600">Change your appointment date and time</p>
          </div>

          <div className={`rounded-lg p-4 mb-6 ${canRescheduleNow ? 'bg-blue-50 border border-blue-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <div className="flex items-start space-x-3">
              {canRescheduleNow
                ? <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              }
              <div>
                <p className={`font-semibold ${canRescheduleNow ? 'text-blue-900' : 'text-yellow-900'}`}>
                  {canRescheduleNow ? 'Free Reschedule Available' : 'Reschedule Policy'}
                </p>
                <p className={`text-sm mt-1 ${canRescheduleNow ? 'text-blue-800' : 'text-yellow-800'}`}>
                  {canRescheduleNow
                    ? 'You can reschedule this appointment for free. Changes must be made at least 24 hours before the scheduled time.'
                    : `This appointment is less than 24 hours away. Please contact support at ${APP_CONFIG.supportEmail} to reschedule.`}
                </p>
              </div>
            </div>
          </div>

          {canRescheduleNow ? (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8">
              <div className="mb-8 pb-8 border-b">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Appointment</h2>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-gray-700">
                    <Calendar className="w-4 h-4" />
                    <span>{format(appointmentDate, 'EEEE, MMMM d, yyyy')}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-700">
                    <Clock className="w-4 h-4" />
                    <span>{format(appointmentDate, 'h:mm a')}</span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-3">Select New Date *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                  {availableDates.map((date) => {
                    const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                    return (
                      <button
                        key={date.toISOString()}
                        type="button"
                        onClick={() => setSelectedDate(date)}
                        className={`p-3 rounded-lg border-2 text-sm transition-all ${
                          isSelected
                            ? 'border-primary-600 bg-primary-50 text-primary-900'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-semibold">{format(date, 'MMM')}</div>
                        <div className="text-2xl font-bold">{format(date, 'd')}</div>
                        <div className="text-xs text-gray-600">{format(date, 'EEE')}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedDate && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Select New Time *</label>
                  {slotsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mr-3"></div>
                      <span className="text-sm text-gray-600">Checking availability...</span>
                    </div>
                  ) : (
                    <>
                      {slotsError && (
                        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800">Could not check slot availability. All slots are shown but some may be taken.</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {TIME_SLOTS.map((slot) => {
                          const unavailable = isSlotUnavailable(slot.time);
                          return (
                            <button
                              key={slot.time}
                              type="button"
                              onClick={() => {
                                if (!unavailable) setSelectedTimeSlot(slot.time);
                              }}
                              disabled={unavailable}
                              className={`p-3 rounded-lg border-2 text-sm transition-all ${
                                unavailable
                                  ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed opacity-50 line-through'
                                  : selectedTimeSlot === slot.time
                                    ? 'border-primary-600 bg-primary-50 text-primary-900'
                                    : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              {slot.label}
                              {unavailable && (
                                <div className="text-xs mt-1" style={{ textDecoration: 'none' }}>Unavailable</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedDate && selectedTimeSlot && (
                <div className="bg-primary-50 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">New Appointment</h3>
                  <div className="space-y-1 text-sm text-gray-700">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>{TIME_SLOTS.find(s => s.time === selectedTimeSlot)?.label}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Link href={`/bookings/${appointment.id}`} className="flex-1">
                  <Button variant="outline" className="w-full">Cancel</Button>
                </Link>
                <Button
                  type="submit"
                  disabled={!selectedDate || !selectedTimeSlot || submitting}
                  isLoading={submitting}
                  className="flex-1"
                >
                  Confirm Reschedule
                </Button>
              </div>
            </form>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <AlertCircle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Reschedule Not Available</h2>
              <p className="text-gray-600 mb-6">
                This appointment is less than 24 hours away. Please contact our support team for assistance.
              </p>
              <div className="space-y-3">
                <a href={`mailto:${APP_CONFIG.supportEmail}`} className="block">
                  <Button className="w-full">Contact Support</Button>
                </a>
                <Link href={`/bookings/${appointment.id}`}>
                  <Button variant="outline" className="w-full">Back to Booking</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showSuccess}
        onClose={() => { setShowSuccess(false); router.push(`/bookings/${appointment.id}`); }}
        title="Reschedule Successful"
      >
        <div className="text-center py-4">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Appointment Rescheduled!</h3>
          <p className="text-gray-600 mb-6">
            Your appointment has been successfully rescheduled to{' '}
            {selectedDate && format(selectedDate, 'MMMM d, yyyy')} at{' '}
            {TIME_SLOTS.find(s => s.time === selectedTimeSlot)?.label}
          </p>
          <Button onClick={() => router.push(`/bookings/${appointment.id}`)}>
            View Updated Booking
          </Button>
        </div>
      </Modal>

      <Footer />
    </div>
  );
}

export default function ReschedulePage() {
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
      <RescheduleContent />
    </Suspense>
  );
}
