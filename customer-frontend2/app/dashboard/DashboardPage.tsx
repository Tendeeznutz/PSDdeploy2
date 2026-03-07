'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import Button from '@/components/Button';
import BookingDetailsModal from '@/components/BookingDetailsModal';
import { appointmentApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { mockAppointments } from '@/lib/mockData';
import type { Appointment } from '@/lib/types';
import { Calendar, MapPin, Clock, Eye, Package } from 'lucide-react';
import { format } from 'date-fns';

export default function DashboardPage() {
  const router = useRouter();
  const { customer, isAuthenticated } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !customer) {
      router.push('/login');
      return;
    }
    loadAppointments();
  }, [customer, isAuthenticated]);

  const loadAppointments = async () => {
    if (!customer) return;
    try {
      setLoading(true);
      
      // Use mock data if it's the test user, otherwise try API
      const isMockUser = customer.id === 'mock-customer-id-123' || customer.customerEmail === 'test@hotmail.com';
      
      if (isMockUser) {
        // Use mock data
        setAppointments(mockAppointments);
      } else {
        // Try real API
        const data = await appointmentApi.getAppointments(customer.id);
        setAppointments(data);
      }
    } catch (error) {
      console.error('Failed to load appointments:', error);
      // Fallback to empty array
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredAppointments = appointments.filter((apt) => {
    if (activeTab === 'upcoming') {
      return apt.appointmentStatus === '1' || apt.appointmentStatus === '2';
    } else if (activeTab === 'completed') {
      return apt.appointmentStatus === '3';
    } else {
      return apt.appointmentStatus === '4';
    }
  });

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp * 1000), 'MMM d, yyyy');
  };

  const formatTime = (timestamp: number) => {
    return format(new Date(timestamp * 1000), 'h:mm a');
  };

  if (!isAuthenticated || !customer) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Bookings</h1>
            <p className="text-gray-600">Manage and track your appointments</p>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                {[
                  { id: 'upcoming', label: 'Upcoming' },
                  { id: 'completed', label: 'Completed' },
                  { id: 'cancelled', label: 'Cancelled' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Appointments List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <EmptyState
              icon={<Package className="w-16 h-16 text-gray-400" />}
              title={`No ${activeTab} appointments`}
              description={
                activeTab === 'upcoming'
                  ? "You don't have any upcoming appointments. Book one now!"
                  : `You don't have any ${activeTab} appointments.`
              }
              action={
                activeTab === 'upcoming' ? (
                  <Link href="/book">
                    <Button>Book Appointment</Button>
                  </Link>
                ) : null
              }
            />
          ) : (
            <div className="space-y-4">
              {filteredAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Booking #{appointment.id.slice(0, 8).toUpperCase()}
                          </h3>
                          <StatusBadge status={appointment.appointmentStatus} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {formatDate(appointment.appointmentStartTime)} at{' '}
                            {formatTime(appointment.appointmentStartTime)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4" />
                          <span>
                            {appointment.customer?.customerAddress || 'Address not available'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Package className="w-4 h-4" />
                          <span>
                            {appointment.airconDevices?.length || appointment.airconToService?.length || 0}{' '}
                            unit(s)
                          </span>
                        </div>
                        {appointment.technician && (
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">Technician:</span>
                            <span>{appointment.technician.technicianName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 md:mt-0 md:ml-6">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedAppointment(appointment);
                          setShowDetailsModal(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Booking Details Modal */}
      {selectedAppointment && (
        <BookingDetailsModal
          appointment={selectedAppointment}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedAppointment(null);
          }}
        />
      )}
      
      <Footer />
    </div>
  );
}
