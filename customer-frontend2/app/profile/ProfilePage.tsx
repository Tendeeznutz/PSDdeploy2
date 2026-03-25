'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import { customerApi, airconDeviceApi, appointmentApi, messageApi, telegramApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { mockCustomer, mockAirconDevices, mockAppointments, mockMessages } from '@/lib/mockData';
import type { Customer, CustomerAirconDevice, Appointment } from '@/lib/types';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Edit,
  Edit3,
  Package,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  MessageCircle,
  Settings,
  TrendingUp,
  Star,
  Plus,
  Trash2,
  Send,
  X,
  Save,
  Check,
  Reply
} from 'lucide-react';
import { format } from 'date-fns';

const AIRCON_TYPES = [
  'daikin', 'mitsubishi', 'panasonic', 'lg', 'samsung',
  'fujitsu', 'sharp', 'toshiba', 'hitachi', 'york', 'other',
] as const;

interface DeviceFormData {
  airconName: string;
  numberOfUnits: number;
  airconType: string;
  lastServiceMonth: string;
  remarks: string;
}

const emptyDeviceForm: DeviceFormData = {
  airconName: '',
  numberOfUnits: 1,
  airconType: 'daikin',
  lastServiceMonth: '',
  remarks: '',
};

export default function ProfilePage() {
  const router = useRouter();
  const { customer, isAuthenticated, logout, login } = useAuthStore();
  const [profile, setProfile] = useState<Customer | null>(null);
  const [airconDevices, setAirconDevices] = useState<CustomerAirconDevice[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'overview' | 'devices' | 'history' | 'messages'>('overview');
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramDeepLink, setTelegramDeepLink] = useState('');
  const [telegramLoading, setTelegramLoading] = useState(false);

  // ── Profile Edit State ──
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    customerPostalCode: '',
  });
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editFeedback, setEditFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Device CRUD State ──
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [deviceModalMode, setDeviceModalMode] = useState<'add' | 'edit'>('add');
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [deviceForm, setDeviceForm] = useState<DeviceFormData>(emptyDeviceForm);
  const [deviceSaving, setDeviceSaving] = useState(false);
  const [deviceFeedback, setDeviceFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteConfirmDevice, setDeleteConfirmDevice] = useState<CustomerAirconDevice | null>(null);
  const [deviceDeleting, setDeviceDeleting] = useState(false);

  // ── Message Compose State ──
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [composeForm, setComposeForm] = useState({ subject: '', body: '' });
  const [composeSending, setComposeSending] = useState(false);
  const [composeFeedback, setComposeFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !customer) {
      router.push('/login');
      return;
    }
    loadProfileData();
    fetchTelegramStatus();
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

  const refreshDevices = async () => {
    if (!customer) return;
    try {
      const isMockUser = customer.id === 'mock-customer-id-123' || customer.customerEmail === 'test@hotmail.com';
      if (!isMockUser) {
        const devicesData = await airconDeviceApi.getDevices(customer.id);
        setAirconDevices(devicesData);
      }
    } catch (error) {
      console.error('Failed to refresh devices:', error);
    }
  };

  const refreshMessages = async () => {
    if (!customer) return;
    try {
      const isMockUser = customer.id === 'mock-customer-id-123' || customer.customerEmail === 'test@hotmail.com';
      if (!isMockUser) {
        const [messagesData, unreadData] = await Promise.all([
          messageApi.getInbox(customer.id, 'customer').catch(() => []),
          messageApi.getUnreadCount(customer.id, 'customer').catch(() => 0),
        ]);
        setMessages(messagesData);
        setUnreadCount(unreadData);
      }
    } catch (error) {
      console.error('Failed to refresh messages:', error);
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

  const fetchTelegramStatus = async () => {
    if (!customer?.id) return;
    try {
      const status = await telegramApi.checkStatus(customer.id);
      setTelegramLinked(status.linked);
    } catch (err) {
      console.error('Error fetching Telegram status:', err);
    }
  };

  const handleConnectTelegram = async () => {
    if (!customer?.id) return;
    setTelegramLoading(true);
    try {
      const result = await telegramApi.generateLink(customer.id);
      setTelegramDeepLink(result.deepLink);
      // Poll for link completion
      const poll = setInterval(async () => {
        try {
          const status = await telegramApi.checkStatus(customer.id);
          if (status.linked) {
            setTelegramLinked(true);
            setTelegramDeepLink('');
            clearInterval(poll);
          }
        } catch {}
      }, 3000);
      setTimeout(() => clearInterval(poll), 600000);
    } catch (err) {
      console.error('Error generating Telegram link:', err);
    }
    setTelegramLoading(false);
  };

  const handleUnlinkTelegram = async () => {
    if (!customer?.id) return;
    try {
      await telegramApi.unlink(customer.id);
      setTelegramLinked(false);
    } catch (err) {
      console.error('Error unlinking Telegram:', err);
    }
  };

  // ── Profile Edit Handlers ──
  const startEditing = () => {
    const p = profile || customer;
    if (!p) return;
    setEditForm({
      customerName: p.customerName || '',
      customerPhone: p.customerPhone || '',
      customerAddress: p.customerAddress || '',
      customerPostalCode: p.customerPostalCode || '',
    });
    setShowPasswordChange(false);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setEditFeedback(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditFeedback(null);
  };

  const validatePhone = (phone: string): boolean => {
    return /^[689]\d{7}$/.test(phone);
  };

  const validatePassword = (password: string): boolean => {
    if (password.length < 8) return false;
    const digitCount = (password.match(/\d/g) || []).length;
    return digitCount >= 3;
  };

  const handleProfileSave = async () => {
    if (!customer) return;

    // Validate phone
    if (!validatePhone(editForm.customerPhone)) {
      setEditFeedback({ type: 'error', message: 'Phone must start with 6, 8, or 9 and be exactly 8 digits.' });
      return;
    }

    if (!editForm.customerName.trim()) {
      setEditFeedback({ type: 'error', message: 'Name is required.' });
      return;
    }

    if (!editForm.customerAddress.trim()) {
      setEditFeedback({ type: 'error', message: 'Address is required.' });
      return;
    }

    if (!editForm.customerPostalCode.trim()) {
      setEditFeedback({ type: 'error', message: 'Postal code is required.' });
      return;
    }

    // Validate password if changing
    if (showPasswordChange) {
      if (!passwordForm.currentPassword) {
        setEditFeedback({ type: 'error', message: 'Current password is required to change password.' });
        return;
      }
      if (!validatePassword(passwordForm.newPassword)) {
        setEditFeedback({ type: 'error', message: 'New password must be at least 8 characters with at least 3 digits.' });
        return;
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setEditFeedback({ type: 'error', message: 'New passwords do not match.' });
        return;
      }
    }

    setEditSaving(true);
    setEditFeedback(null);

    try {
      const updateData: any = { ...editForm };
      if (showPasswordChange && passwordForm.newPassword) {
        updateData.currentPassword = passwordForm.currentPassword;
        updateData.customerPassword = passwordForm.newPassword;
      }

      const updatedProfile = await customerApi.updateProfile(customer.id, updateData);
      setProfile(updatedProfile);

      // Update Zustand store so navbar reflects changes
      login({ ...customer, ...updatedProfile });

      setEditFeedback({ type: 'success', message: 'Profile updated successfully!' });
      setTimeout(() => {
        setIsEditing(false);
        setEditFeedback(null);
      }, 1500);
    } catch (error: any) {
      const msg = error?.response?.data?.detail || error?.response?.data?.message || 'Failed to update profile. Please try again.';
      setEditFeedback({ type: 'error', message: msg });
    } finally {
      setEditSaving(false);
    }
  };

  // ── Device CRUD Handlers ──
  const openAddDevice = () => {
    setDeviceForm(emptyDeviceForm);
    setDeviceModalMode('add');
    setEditingDeviceId(null);
    setDeviceFeedback(null);
    setDeviceModalOpen(true);
  };

  const openEditDevice = (device: CustomerAirconDevice) => {
    setDeviceForm({
      airconName: device.airconName || '',
      numberOfUnits: device.numberOfUnits || 1,
      airconType: device.airconType || 'other',
      lastServiceMonth: device.lastServiceMonth || '',
      remarks: device.remarks || '',
    });
    setDeviceModalMode('edit');
    setEditingDeviceId(device.id);
    setDeviceFeedback(null);
    setDeviceModalOpen(true);
  };

  const handleDeviceSave = async () => {
    if (!customer) return;

    if (deviceForm.numberOfUnits < 1 || deviceForm.numberOfUnits > 10) {
      setDeviceFeedback({ type: 'error', message: 'Number of units must be between 1 and 10.' });
      return;
    }

    setDeviceSaving(true);
    setDeviceFeedback(null);

    try {
      if (deviceModalMode === 'add') {
        const newDevice = await airconDeviceApi.createDevice({
          customerId: customer.id,
          airconName: deviceForm.airconName || 'Unnamed Device',
          numberOfUnits: deviceForm.numberOfUnits,
          airconType: deviceForm.airconType as any,
          lastServiceMonth: deviceForm.lastServiceMonth || undefined,
          remarks: deviceForm.remarks || undefined,
        });
        setAirconDevices((prev) => [...prev, newDevice]);
      } else if (editingDeviceId) {
        const updated = await airconDeviceApi.updateDevice(editingDeviceId, {
          airconName: deviceForm.airconName || 'Unnamed Device',
          numberOfUnits: deviceForm.numberOfUnits,
          airconType: deviceForm.airconType as any,
          lastServiceMonth: deviceForm.lastServiceMonth || undefined,
          remarks: deviceForm.remarks || undefined,
        });
        setAirconDevices((prev) => prev.map((d) => (d.id === editingDeviceId ? updated : d)));
      }
      setDeviceFeedback({ type: 'success', message: deviceModalMode === 'add' ? 'Device added!' : 'Device updated!' });
      setTimeout(() => {
        setDeviceModalOpen(false);
        setDeviceFeedback(null);
      }, 1000);
      await refreshDevices();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to save device. Please try again.';
      setDeviceFeedback({ type: 'error', message: msg });
    } finally {
      setDeviceSaving(false);
    }
  };

  const handleDeviceDelete = async () => {
    if (!deleteConfirmDevice) return;
    setDeviceDeleting(true);
    try {
      await airconDeviceApi.deleteDevice(deleteConfirmDevice.id);
      setAirconDevices((prev) => prev.filter((d) => d.id !== deleteConfirmDevice.id));
      setDeleteConfirmDevice(null);
      await refreshDevices();
    } catch (error: any) {
      console.error('Failed to delete device:', error);
      const msg = error?.response?.data?.detail || 'Failed to delete device. It may be linked to an active appointment.';
      setDeviceFeedback({ type: 'error', message: msg });
      setDeleteConfirmDevice(null);
    } finally {
      setDeviceDeleting(false);
    }
  };

  // ── Message Compose Handlers ──
  const openCompose = (prefillSubject?: string) => {
    setComposeForm({ subject: prefillSubject || '', body: '' });
    setComposeFeedback(null);
    setComposeModalOpen(true);
  };

  const handleSendMessage = async () => {
    if (!customer) return;

    if (!composeForm.subject.trim()) {
      setComposeFeedback({ type: 'error', message: 'Subject is required.' });
      return;
    }
    if (!composeForm.body.trim()) {
      setComposeFeedback({ type: 'error', message: 'Message body is required.' });
      return;
    }

    setComposeSending(true);
    setComposeFeedback(null);

    try {
      await messageApi.sendMessage({
        senderId: customer.id,
        senderType: 'customer',
        senderName: customer.customerName || (customer as any).name || 'Customer',
        subject: composeForm.subject.trim(),
        body: composeForm.body.trim(),
      });
      setComposeFeedback({ type: 'success', message: 'Message sent successfully!' });
      setTimeout(() => {
        setComposeModalOpen(false);
        setComposeFeedback(null);
      }, 1200);
      await refreshMessages();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to send message. Please try again.';
      setComposeFeedback({ type: 'error', message: msg });
    } finally {
      setComposeSending(false);
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
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>
                    {!isEditing && (
                      <Button variant="outline" size="sm" onClick={startEditing}>
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit Profile
                      </Button>
                    )}
                  </div>

                  {/* Success/Error Feedback */}
                  {editFeedback && (
                    <div
                      className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
                        editFeedback.type === 'success'
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {editFeedback.type === 'success' ? (
                        <Check className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      )}
                      {editFeedback.message}
                    </div>
                  )}

                  {isEditing ? (
                    /* ── Edit Mode ── */
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Name */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                          <input
                            type="text"
                            value={editForm.customerName}
                            onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                          />
                        </div>

                        {/* Email (read-only) */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                          <input
                            type="email"
                            value={profile?.customerEmail || customer.customerEmail}
                            disabled
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                          />
                          <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                        </div>

                        {/* Phone */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                          <input
                            type="tel"
                            value={editForm.customerPhone}
                            onChange={(e) => setEditForm({ ...editForm, customerPhone: e.target.value })}
                            placeholder="e.g. 91234567"
                            maxLength={8}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                          />
                          <p className="text-xs text-gray-400 mt-1">Singapore number starting with 6, 8, or 9</p>
                        </div>

                        {/* Postal Code */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                          <input
                            type="text"
                            value={editForm.customerPostalCode}
                            onChange={(e) => setEditForm({ ...editForm, customerPostalCode: e.target.value })}
                            maxLength={6}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                          />
                        </div>

                        {/* Address (full width) */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                          <input
                            type="text"
                            value={editForm.customerAddress}
                            onChange={(e) => setEditForm({ ...editForm, customerAddress: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                          />
                        </div>
                      </div>

                      {/* Password Change Section */}
                      <div className="border-t pt-4">
                        {!showPasswordChange ? (
                          <button
                            type="button"
                            onClick={() => setShowPasswordChange(true)}
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                          >
                            Change Password
                          </button>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-gray-700">Change Password</h3>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowPasswordChange(false);
                                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                }}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                                <input
                                  type="password"
                                  value={passwordForm.currentPassword}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                <input
                                  type="password"
                                  value={passwordForm.newPassword}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                                />
                                <p className="text-xs text-gray-400 mt-1">Min 8 characters, at least 3 digits</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                                <input
                                  type="password"
                                  value={passwordForm.confirmPassword}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Save / Cancel buttons */}
                      <div className="flex items-center gap-3 pt-2">
                        <Button onClick={handleProfileSave} isLoading={editSaving}>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                        <Button variant="outline" onClick={cancelEditing} disabled={editSaving}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* ── View Mode ── */
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
                  )}

                  {/* Rating */}
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Rating</span>
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= Math.round((customer as any)?.customerRating || 0)
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-600">
                        ({((customer as any)?.customerRating || 0).toFixed(1)} / 5 from {(customer as any)?.ratingCount || 0} reviews)
                      </span>
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

                {/* Telegram Notifications */}
                <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-blue-500" />
                    Telegram Notifications
                  </h3>
                  {telegramLinked ? (
                    <div className="flex items-center justify-between bg-green-50 p-4 rounded-lg border border-green-200">
                      <span className="text-green-700 text-sm font-medium">
                        Connected — You'll receive notifications on Telegram
                      </span>
                      <button
                        onClick={handleUnlinkTelegram}
                        className="text-red-500 hover:text-red-700 text-sm underline ml-3"
                      >
                        Unlink
                      </button>
                    </div>
                  ) : telegramDeepLink ? (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-600 mb-3">
                        Click below to open Telegram and link your account:
                      </p>
                      <a
                        href={telegramDeepLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                      >
                        Open in Telegram
                      </a>
                      <p className="text-xs text-gray-400 mt-2">Link expires in 10 minutes. Waiting for connection...</p>
                    </div>
                  ) : (
                    <button
                      onClick={handleConnectTelegram}
                      disabled={telegramLoading}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      {telegramLoading ? 'Generating link...' : 'Connect Telegram'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Devices Section */}
            {activeSection === 'devices' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">My Aircon Devices</h2>
                  <Button size="sm" onClick={openAddDevice}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Device
                  </Button>
                </div>

                {/* Device Feedback */}
                {deviceFeedback && !deviceModalOpen && (
                  <div
                    className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                      deviceFeedback.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {deviceFeedback.type === 'success' ? (
                      <Check className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    {deviceFeedback.message}
                  </div>
                )}

                {airconDevices.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">No devices registered yet</p>
                    <Button onClick={openAddDevice}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Your First Device
                    </Button>
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
                          <div className="flex items-center gap-2">
                            <div className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-xs font-medium">
                              {device.numberOfUnits || 1} unit{device.numberOfUnits !== 1 ? 's' : ''}
                            </div>
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
                        {/* Action buttons */}
                        <div className="mt-3 pt-3 border-t flex items-center gap-2">
                          <button
                            onClick={() => openEditDevice(device)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirmDevice(device)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
                  <Button size="sm" onClick={() => openCompose()}>
                    <Send className="w-4 h-4 mr-1" />
                    Compose
                  </Button>
                </div>

                {/* Compose Feedback (outside modal) */}
                {composeFeedback && !composeModalOpen && (
                  <div
                    className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                      composeFeedback.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {composeFeedback.type === 'success' ? (
                      <Check className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    {composeFeedback.message}
                  </div>
                )}

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
                          <div className="flex items-center gap-2">
                            {!message.isRead && (
                              <button
                                onClick={async () => {
                                  const isMockUser = customer?.id === 'mock-customer-id-123' || customer?.customerEmail === 'test@hotmail.com';
                                  if (isMockUser) {
                                    setMessages(messages.map(m => m.id === message.id ? { ...m, isRead: true } : m));
                                    setUnreadCount(Math.max(0, unreadCount - 1));
                                  } else {
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
                            <button
                              onClick={() => openCompose(`RE: ${message.subject.replace(/^RE:\s*/i, '')}`)}
                              className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                            >
                              <Reply className="w-3.5 h-3.5" />
                              Reply
                            </button>
                          </div>
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

      {/* ══════════════════════════════════════════════
          MODALS
         ══════════════════════════════════════════════ */}

      {/* Device Add/Edit Modal */}
      <Modal
        isOpen={deviceModalOpen}
        onClose={() => { if (!deviceSaving) setDeviceModalOpen(false); }}
        title={deviceModalMode === 'add' ? 'Add Device' : 'Edit Device'}
        size="md"
      >
        <div className="space-y-4">
          {deviceFeedback && (
            <div
              className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                deviceFeedback.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {deviceFeedback.type === 'success' ? (
                <Check className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              {deviceFeedback.message}
            </div>
          )}

          {/* Device Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Device Name <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={deviceForm.airconName}
              onChange={(e) => setDeviceForm({ ...deviceForm, airconName: e.target.value })}
              placeholder="e.g. Living Room AC"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
            />
          </div>

          {/* Aircon Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aircon Brand</label>
            <select
              value={deviceForm.airconType}
              onChange={(e) => setDeviceForm({ ...deviceForm, airconType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
            >
              {AIRCON_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Number of Units */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Units</label>
            <input
              type="number"
              min={1}
              max={10}
              value={deviceForm.numberOfUnits}
              onChange={(e) => setDeviceForm({ ...deviceForm, numberOfUnits: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
            />
            <p className="text-xs text-gray-400 mt-1">Between 1 and 10</p>
          </div>

          {/* Last Service Month */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Service Month</label>
            <input
              type="month"
              value={deviceForm.lastServiceMonth}
              onChange={(e) => setDeviceForm({ ...deviceForm, lastServiceMonth: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remarks <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={deviceForm.remarks}
              onChange={(e) => setDeviceForm({ ...deviceForm, remarks: e.target.value })}
              rows={3}
              placeholder="Any additional notes about this device..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleDeviceSave} isLoading={deviceSaving}>
              <Save className="w-4 h-4 mr-2" />
              {deviceModalMode === 'add' ? 'Add Device' : 'Save Changes'}
            </Button>
            <Button variant="outline" onClick={() => setDeviceModalOpen(false)} disabled={deviceSaving}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Device Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmDevice}
        onClose={() => { if (!deviceDeleting) setDeleteConfirmDevice(null); }}
        title="Delete Device"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">
              {deleteConfirmDevice?.airconName || 'this device'}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDeviceDelete}
              disabled={deviceDeleting}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {deviceDeleting ? (
                <>
                  <span className="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </button>
            <Button variant="outline" onClick={() => setDeleteConfirmDevice(null)} disabled={deviceDeleting}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Compose Message Modal */}
      <Modal
        isOpen={composeModalOpen}
        onClose={() => { if (!composeSending) setComposeModalOpen(false); }}
        title="Compose Message"
        size="md"
      >
        <div className="space-y-4">
          {composeFeedback && (
            <div
              className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                composeFeedback.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {composeFeedback.type === 'success' ? (
                <Check className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              {composeFeedback.message}
            </div>
          )}

          <div>
            <p className="text-sm text-gray-500 mb-3">
              Your message will be sent to our service coordinators.
            </p>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={composeForm.subject}
              onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
              placeholder="Enter subject..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={composeForm.body}
              onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
              rows={6}
              placeholder="Type your message here..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSendMessage} isLoading={composeSending}>
              <Send className="w-4 h-4 mr-2" />
              Send Message
            </Button>
            <Button variant="outline" onClick={() => setComposeModalOpen(false)} disabled={composeSending}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Footer />
    </div>
  );
}
