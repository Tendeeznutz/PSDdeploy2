'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Button from '@/components/Button';
import { customerApi, airconDeviceApi, appointmentApi, messageApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { mockCustomer, mockAirconDevices, mockAppointments, mockMessages } from '@/lib/mockData';
import type { Customer, CustomerAirconDevice, Appointment } from '@/lib/types';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Edit, 
  Package, 
  Calendar, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  Settings,
  TrendingUp,
  Star
} from 'lucide-react';
import { format } from 'date-fns';

export default function ProfilePage() {
  const router = useRouter();
  const { customer, isAuthenticated, logout } = useAuthStore();
  const [profile, setProfile] = useState<Customer | null>(null);
  const [airconDevices, setAirconDevices] = useState<CustomerAirconDevice[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'overview' | 'devices' | 'history' | 'messages'>('overview');

  useEffect(() => {
    if (!isAuthenticated || !customer) {
      router.push('/login');
      return;
    }
    loadProfileData();
  }, [customer, isAuthenticated]);

  const loadProfileData = async () => {
    if (!customer) return;
    try {
      setLoading(true);
      
      // Use mock data if it's the test user, otherwise try API
      const isMockUser = customer.id === 'mock-customer-id-123' || customer.customerEmail === 'test@hotmail.com';
      
      if (isMockUser) {
        // Use mock data
        setProfile(mockCustomer);
        setAirconDevices(mockAirconDevices);
        setAppointments(mockAppointments);
        setMessages(mockMessages);
        setUnreadCount(mockMessages.filter(m => !m.isRead).length);
      } else {
        // Try real API
        const [profileData, devicesData, appointmentsData, messagesData, unreadData] = await Promise.all([
          customerApi.getProfile(customer.id).catch(() => customer),
          airconDeviceApi.getDevices(customer.id).catch(() => []),
          appointmentApi.getAppointments(customer.id).catch(() => []),
          messageApi.getInbox(customer.id, 'customer').catch(() => []),
          messageApi.getUnreadCount(customer.id, 'customer').catch(() => 0),
        ]);
        setProfile(profileData);
        setAirconDevices(devicesData);
        setAppointments(appointmentsData);
        setMessages(messagesData);
        setUnreadCount(unreadData);
      }
    } catch (error) {
      console.error('Failed to load profile data:', error);
      setProfile(customer);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    totalAppointments: appointments.length,
    completed: appointments.filter(a => a.appointmentStatus === '3').length,
    upcoming: appointments.filter(a => a.appointmentStatus === '1' || a.appointmentStatus === '2').length,
    cancelled: appointments.filter(a => a.appointmentStatus === '4').length,
    totalDevices: airconDevices.length,
    totalUnits: airconDevices.reduce((sum, device) => sum + (device.numberOfUnits || 1), 0),
  };

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp * 1000), 'MMM d, yyyy');
  };

  const formatTime = (timestamp: number) => {
    return format(new Date(timestamp * 1000), 'h:mm a');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case '3':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case '4':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case '2':
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    }
  };

  if (!isAuthenticated || !customer) {
    return null;
  }

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">My Profile</h1>
                <p className="text-gray-600">Manage your account and view your service history</p>
              </div>
              <div className="flex gap-3">
                <Link href="/dashboard">
                  <Button variant="outline">View Bookings</Button>
                </Link>
                <Button variant="outline" onClick={logout}>
                  Logout
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Appointments</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalAppointments}</p>
                </div>
                <Calendar className="w-8 h-8 text-primary-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Upcoming</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.upcoming}</p>
                </div>
                <Clock className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Aircon Devices</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalDevices}</p>
                </div>
                <Package className="w-8 h-8 text-primary-600" />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                {[
                  { id: 'overview', label: 'Overview', icon: User },
                  { id: 'devices', label: 'My Devices', icon: Package },
                  { id: 'history', label: 'Service History', icon: Calendar },
                  { id: 'messages', label: `Messages${unreadCount > 0 ? ` (${unreadCount})` : ''}`, icon: MessageSquare },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSection(tab.id as any)}
                    className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                      activeSection === tab.id
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content Sections */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Overview Section */}
            {activeSection === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Personal Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-start space-x-3">
                      <User className="w-5 h-5 text-gray-400 mt-1" />
                      <div>
                        <p className="text-sm text-gray-600">Name</p>
                        <p className="font-medium text-gray-900">{profile?.customerName || customer.customerName}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Mail className="w-5 h-5 text-gray-400 mt-1" />
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-medium text-gray-900">{profile?.customerEmail || customer.customerEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Phone className="w-5 h-5 text-gray-400 mt-1" />
                      <div>
                        <p className="text-sm text-gray-600">Phone</p>
                        <p className="font-medium text-gray-900">{profile?.customerPhone || customer.customerPhone}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-gray-400 mt-1" />
                      <div>
                        <p className="text-sm text-gray-600">Address</p>
                        <p className="font-medium text-gray-900">
                          {profile?.customerAddress || customer.customerAddress}
                        </p>
                        <p className="text-sm text-gray-600">
                          Singapore {profile?.customerPostalCode || customer.customerPostalCode}
                        </p>
                        {profile?.customerLocation && (
                          <p className="text-xs text-gray-500 mt-1">Location: {profile.customerLocation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Service Summary</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Total Services</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
                      <p className="text-xs text-gray-500 mt-1">Completed appointments</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Total Units</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalUnits}</p>
                      <p className="text-xs text-gray-500 mt-1">Across all devices</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Member Since</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {profile?.created_at 
                          ? format(new Date(profile.created_at), 'MMM yyyy')
                          : 'Recently'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/book">
                      <Button>Book New Service</Button>
                    </Link>
                    <Link href="/dashboard">
                      <Button variant="outline">View All Bookings</Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Devices Section */}
            {activeSection === 'devices' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">My Aircon Devices</h2>
                  <Link href="/book">
                    <Button size="sm">Add Device</Button>
                  </Link>
                </div>
                {airconDevices.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">No devices registered yet</p>
                    <Link href="/book">
                      <Button>Add Your First Device</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {airconDevices.map((device) => (
                      <div key={device.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">{device.airconName || 'Unnamed Device'}</h3>
                            <p className="text-sm text-gray-600 capitalize">{device.airconType}</p>
                          </div>
                          <div className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-xs font-medium">
                            {device.numberOfUnits || 1} unit{device.numberOfUnits !== 1 ? 's' : ''}
                          </div>
                        </div>
                        {device.lastServiceMonth && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-gray-600">Last Service</p>
                            <p className="text-sm font-medium text-gray-900">{device.lastServiceMonth}</p>
                          </div>
                        )}
                        {device.remarks && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-600">Remarks</p>
                            <p className="text-sm text-gray-700">{device.remarks}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* History Section */}
            {activeSection === 'history' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Service History</h2>
                {appointments.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">No service history yet</p>
                    <Link href="/book">
                      <Button>Book Your First Service</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {appointments
                      .sort((a, b) => b.appointmentStartTime - a.appointmentStartTime)
                      .map((appointment) => (
                        <div key={appointment.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start space-x-3">
                              {getStatusIcon(appointment.appointmentStatus)}
                              <div>
                                <h3 className="font-semibold text-gray-900">
                                  Booking #{appointment.id.slice(0, 8).toUpperCase()}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  {formatDate(appointment.appointmentStartTime)} at {formatTime(appointment.appointmentStartTime)}
                                </p>
                              </div>
                            </div>
                            <Link href={`/bookings/${appointment.id}`}>
                              <Button variant="outline" size="sm">View Details</Button>
                            </Link>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                            <div>
                              <p className="text-gray-600">Status</p>
                              <p className="font-medium text-gray-900">
                                {appointment.appointmentStatus === '1' ? 'Pending' :
                                 appointment.appointmentStatus === '2' ? 'Confirmed' :
                                 appointment.appointmentStatus === '3' ? 'Completed' : 'Cancelled'}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Units</p>
                              <p className="font-medium text-gray-900">
                                {appointment.airconDevices?.length || appointment.airconToService?.length || 0}
                              </p>
                            </div>
                            {appointment.technician && (
                              <div>
                                <p className="text-gray-600">Technician</p>
                                <p className="font-medium text-gray-900">{appointment.technician.technicianName}</p>
                              </div>
                            )}
                            {appointment.customerFeedback && (
                              <div>
                                <p className="text-gray-600">Feedback</p>
                                <div className="flex items-center gap-1">
                                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                  <span className="font-medium text-gray-900">Provided</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Messages Section */}
            {activeSection === 'messages' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Messages</h2>
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">No messages yet</p>
                    <p className="text-sm text-gray-500">You'll receive notifications about your appointments here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                          !message.isRead ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{message.subject}</h3>
                              {!message.isRead && (
                                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">New</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              From: {message.senderName} ({message.senderType})
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {format(new Date(message.created_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                          {!message.isRead && (
                            <button
                              onClick={async () => {
                                const isMockUser = customer?.id === 'mock-customer-id-123' || customer?.customerEmail === 'test@hotmail.com';
                                if (isMockUser) {
                                  // Update mock data
                                  setMessages(messages.map(m => m.id === message.id ? { ...m, isRead: true } : m));
                                  setUnreadCount(Math.max(0, unreadCount - 1));
                                } else {
                                  // Try real API
                                  try {
                                    await messageApi.markAsRead(message.id);
                                    setMessages(messages.map(m => m.id === message.id ? { ...m, isRead: true } : m));
                                    setUnreadCount(Math.max(0, unreadCount - 1));
                                  } catch (error) {
                                    console.error('Failed to mark as read:', error);
                                  }
                                }
                              }}
                              className="text-xs text-primary-600 hover:text-primary-700"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                        <p className="text-gray-700 mt-3">{message.body}</p>
                        {message.relatedAppointment && (
                          <div className="mt-3 pt-3 border-t">
                            <Link
                              href={`/bookings/${message.relatedAppointment}`}
                              className="text-sm text-primary-600 hover:text-primary-700"
                            >
                              View related appointment →
                            </Link>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
