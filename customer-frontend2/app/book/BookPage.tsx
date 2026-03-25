'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Stepper from '@/components/Stepper';
import ServiceCard from '@/components/ServiceCard';
import Button from '@/components/Button';
import { SERVICES, ADD_ONS, TIME_SLOTS, TRAVEL_FEE, PAYMENT_METHODS } from '@/lib/constants';
import { appointmentApi, convertBookingToApiFormat, customerApi, airconDeviceApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { BookingFormData, CustomerAirconDevice } from '@/lib/types';
import {
  Calendar,
  MapPin,
  User,
  CreditCard,
  CheckCircle,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

const STEPS = ['Service', 'Address', 'Schedule', 'Contact', 'Review'];

// Buffer used by the backend (2.5 hours in seconds)
const UNAVAILABLE_BUFFER = 9000;

function BookPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { customer, isAuthenticated, login } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [airconDevices, setAirconDevices] = useState<CustomerAirconDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [numberOfUnits, setNumberOfUnits] = useState(1);
  const [unavailableSlots, setUnavailableSlots] = useState<number[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  const [penaltyStatus, setPenaltyStatus] = useState<any>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<BookingFormData>({
    defaultValues: {
      serviceType: searchParams?.get('service') || '',
      airconDevices: ['temp-0'], // Default to 1 unit
      addOns: searchParams?.getAll('addons') || [],
      address: customer?.customerAddress || '',
      postalCode: customer?.customerPostalCode || '',
      date: null,
      timeSlot: '',
      name: customer?.customerName || '',
      email: customer?.customerEmail || '',
      phone: customer?.customerPhone || '',
      isLoggedIn: isAuthenticated,
      paymentMethod: 'cash',
    },
  });

  const watchedValues = watch();

  useEffect(() => {
    // Generate available dates (next 30 days, excluding Sundays)
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      if (date.getDay() !== 0) { // Exclude Sundays
        dates.push(date);
      }
    }
    setAvailableDates(dates);
  }, []);

  useEffect(() => {
    if (isAuthenticated && customer) {
      loadAirconDevices();
    }
  }, [isAuthenticated, customer]);

  // Handle query params from estimate page
  useEffect(() => {
    const service = searchParams?.get('service');
    const units = searchParams?.get('units');
    const addons = searchParams?.getAll('addons');
    const priority = searchParams?.get('priority');

    if (service) {
      setValue('serviceType', service);
    }
    if (units) {
      const unitsNum = parseInt(units);
      if (!isNaN(unitsNum) && unitsNum > 0) {
        setNumberOfUnits(unitsNum);
        setValue('airconDevices', Array(unitsNum).fill('').map((_, i) => `temp-${i}`));
      }
    }
    if (addons && addons.length > 0) {
      setValue('addOns', addons);
    }
  }, [searchParams, setValue]);

  const loadAirconDevices = async () => {
    if (!customer) return;
    try {
      const devices = await airconDeviceApi.getDevices(customer.id);
      setAirconDevices(devices);
    } catch (error) {
      console.error('Failed to load aircon devices:', error);
    }
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
        setUnavailableSlots(data.unavailable_timeslots || []);
      } catch (err) {
        console.error('Failed to fetch unavailable slots:', err);
        setSlotsError(true);
        setUnavailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };

    fetchUnavailableSlots();
  }, [selectedDate, customer]);

  // Fetch penalty status when reaching the review step
  useEffect(() => {
    if (currentStep === 5 && customer) {
      appointmentApi.getPenaltyStatus(customer.id)
        .then((data) => setPenaltyStatus(data))
        .catch((err) => console.error('Failed to fetch penalty status:', err));
    }
  }, [currentStep, customer]);

  // Clear time slot selection if the selected time becomes unavailable after date change
  useEffect(() => {
    if (!selectedDate || !watchedValues.timeSlot) return;
    if (isSlotUnavailable(watchedValues.timeSlot)) {
      setValue('timeSlot', '');
    }
  }, [unavailableSlots, selectedDate]);

  const isSlotUnavailable = (slotTime: string): boolean => {
    if (!selectedDate || unavailableSlots.length === 0) return false;

    const [hours, minutes] = slotTime.split(':').map(Number);
    const slotDate = new Date(selectedDate);
    slotDate.setHours(hours, minutes, 0, 0);
    const slotTimestamp = Math.floor(slotDate.getTime() / 1000);

    // Check if this slot overlaps with any unavailable appointment window
    // An appointment at time T blocks the range [T - BUFFER, T + BUFFER]
    return unavailableSlots.some((unavailableTime) => {
      const blockStart = unavailableTime - UNAVAILABLE_BUFFER;
      const blockEnd = unavailableTime + UNAVAILABLE_BUFFER;
      return slotTimestamp >= blockStart && slotTimestamp <= blockEnd;
    });
  };

  const calculateTotal = () => {
    const service = SERVICES.find(s => s.id === watchedValues.serviceType);
    if (!service) return 0;

    const serviceCost = service.basePrice > 0
      ? service.basePrice
      : service.pricePerUnit * numberOfUnits;

    const addOnsCost = ADD_ONS
      .filter(addon => watchedValues.addOns?.includes(addon.id))
      .reduce((sum, addon) => sum + addon.price, 0);

    const penaltyFee = penaltyStatus && parseFloat(penaltyStatus.pending_penalty_fee) > 0
      ? parseFloat(penaltyStatus.pending_penalty_fee)
      : 0;

    return serviceCost + addOnsCost + TRAVEL_FEE + penaltyFee;
  };

  const onSubmit = async (data: BookingFormData) => {
    setLoading(true);
    setError('');

    const successData = {
      bookingId: 'BK' + Date.now().toString().slice(-8),
      service: SERVICES.find(s => s.id === data.serviceType)?.name || 'General Servicing',
      units: numberOfUnits,
      addOns: ADD_ONS.filter(a => data.addOns?.includes(a.id)).map(a => a.name),
      date: data.date ? data.date.toISOString() : new Date().toISOString(),
      time: TIME_SLOTS.find(s => s.time === data.timeSlot)?.label || '11:00 AM',
      address: data.address,
      postalCode: data.postalCode,
      name: data.name,
      email: data.email,
      phone: data.phone,
      paymentMethod: PAYMENT_METHODS.find(p => p.value === data.paymentMethod)?.label || data.paymentMethod,
      total: calculateTotal(),
    };

    try {
      let customerId = customer?.id;

      // If not logged in, create customer account
      if (!customerId) {
        const tempPassword = `temp${Date.now()}`;
        const newCustomer = await customerApi.register({
          customerName: data.name,
          customerEmail: data.email,
          customerPassword: tempPassword,
          customerPhone: data.phone,
          customerAddress: data.address,
          customerPostalCode: data.postalCode,
        });
        customerId = newCustomer.id;

        try {
          const authResponse = await customerApi.login(data.email, tempPassword);
          const fullCustomer = await customerApi.getProfile(authResponse.customer_id);
          login(fullCustomer);
        } catch (loginError) {
          console.warn('Auto-login failed, continuing anyway:', loginError);
        }
      }

      const deviceIds: string[] = [];
      const selectedSavedDevices = watchedValues.airconDevices?.filter(id => !id.startsWith('temp-')) || [];

      if (selectedSavedDevices.length > 0) {
        deviceIds.push(...selectedSavedDevices);
      } else {
        for (let i = 0; i < numberOfUnits; i++) {
          const device = await airconDeviceApi.createDevice({
            customerId: customerId,
            airconName: `Unit ${i + 1}`,
            numberOfUnits: 1,
            airconType: 'other',
          } as any);
          deviceIds.push(device.id);
        }
      }

      const bookingData = {
        customerId: customerId,
        appointmentStartTime: Math.floor((data.date!.getTime() + (parseInt(data.timeSlot.split(':')[0]) * 3600000) + (parseInt(data.timeSlot.split(':')[1]) * 60000)) / 1000),
        appointmentEndTime: Math.floor((data.date!.getTime() + (parseInt(data.timeSlot.split(':')[0]) * 3600000) + (parseInt(data.timeSlot.split(':')[1]) * 60000)) / 1000) + (numberOfUnits * 3600),
        airconToService: deviceIds,
        paymentMethod: data.paymentMethod,
      };

      const appointment = await appointmentApi.createAppointment(bookingData);
      successData.bookingId = appointment.id?.slice(0, 8).toUpperCase() || successData.bookingId;
      localStorage.setItem('lastBooking', JSON.stringify(successData));
      router.push('/booking-success');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Booking failed. Please try again.';
      setError(typeof msg === 'string' ? msg : 'Booking failed.');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      // Use CSS transitions instead of GSAP for simplicity
      const stepContent = document.querySelector('.step-content');
      if (stepContent) {
        (stepContent as HTMLElement).style.opacity = '0';
        (stepContent as HTMLElement).style.transform = 'translateX(-20px)';
      }
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
        setTimeout(() => {
          const newStepContent = document.querySelector('.step-content');
          if (newStepContent) {
            (newStepContent as HTMLElement).style.opacity = '1';
            (newStepContent as HTMLElement).style.transform = 'translateX(0)';
          }
        }, 50);
      }, 200);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      // Use CSS transitions instead of GSAP for simplicity
      const stepContent = document.querySelector('.step-content');
      if (stepContent) {
        (stepContent as HTMLElement).style.opacity = '0';
        (stepContent as HTMLElement).style.transform = 'translateX(20px)';
      }
      setTimeout(() => {
        setCurrentStep(currentStep - 1);
        setTimeout(() => {
          const newStepContent = document.querySelector('.step-content');
          if (newStepContent) {
            (newStepContent as HTMLElement).style.opacity = '1';
            (newStepContent as HTMLElement).style.transform = 'translateX(0)';
          }
        }, 50);
      }, 200);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!watchedValues.serviceType && numberOfUnits > 0;
      case 2:
        return !!watchedValues.address && !!watchedValues.postalCode;
      case 3:
        return !!watchedValues.date && !!watchedValues.timeSlot;
      case 4:
        return !!watchedValues.name && !!watchedValues.email && !!watchedValues.phone;
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="pt-20 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Book your service</h1>
            <p className="text-gray-600">Complete your booking in a few simple steps</p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
            <Stepper steps={STEPS} currentStep={currentStep} />
            
            <form onSubmit={handleSubmit(onSubmit)} className="mt-8">
              <div className="step-content transition-all duration-300">
                {/* Step 1: Service Selection */}
                {currentStep === 1 && (
                  <div className="mt-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">What service do you need?</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                      {SERVICES.map((service) => (
                        <ServiceCard
                          key={service.id}
                          service={service}
                          isSelected={watchedValues.serviceType === service.id}
                          onSelect={(id) => setValue('serviceType', id)}
                        />
                      ))}
                    </div>

                    {watchedValues.serviceType && (
                      <>
                        <h3 className="text-lg font-semibold mb-4">How many aircon units need servicing?</h3>
                        
                        {/* For logged-in users with saved devices */}
                        {isAuthenticated && airconDevices.length > 0 && (
                          <div className="mb-6">
                            <p className="text-sm text-gray-600 mb-3">Select from your saved devices (optional):</p>
                            <div className="space-y-2 mb-4">
                              {airconDevices.map((device) => (
                                <label
                                  key={device.id}
                                  className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                                  onClick={(e) => {
                                    // If device is selected, use it; otherwise use number selector
                                    const checkbox = e.currentTarget.querySelector('input[type="checkbox"]') as HTMLInputElement;
                                    if (checkbox?.checked) {
                                      // Use saved device, update number of units
                                      setNumberOfUnits(device.numberOfUnits);
                                    }
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    {...register('airconDevices')}
                                    value={device.id}
                                    className="mr-3"
                                  />
                                  <div className="flex-1">
                                    <p className="font-medium">{device.airconName}</p>
                                    <p className="text-sm text-gray-600">
                                      {device.airconType} • {device.numberOfUnits} unit(s)
                                    </p>
                                  </div>
                                </label>
                              ))}
                            </div>
                            <div className="text-sm text-gray-500 mb-4 text-center">or specify number of units below</div>
                          </div>
                        )}

                        {/* Simple unit selector for all users */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Number of units *
                          </label>
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => {
                                const newValue = Math.max(1, numberOfUnits - 1);
                                setNumberOfUnits(newValue);
                                // Create temporary device IDs for guest users
                                setValue('airconDevices', Array(newValue).fill('').map((_, i) => `temp-${i}`));
                              }}
                              className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                            >
                              <span className="text-xl">−</span>
                            </button>
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={numberOfUnits}
                              onChange={(e) => {
                                const value = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
                                setNumberOfUnits(value);
                                setValue('airconDevices', Array(value).fill('').map((_, i) => `temp-${i}`));
                              }}
                              className="w-20 px-4 py-2 border rounded-lg text-center font-semibold focus:ring-2 focus:ring-primary-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newValue = Math.min(20, numberOfUnits + 1);
                                setNumberOfUnits(newValue);
                                setValue('airconDevices', Array(newValue).fill('').map((_, i) => `temp-${i}`));
                              }}
                              className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                            >
                              <span className="text-xl">+</span>
                            </button>
                            <span className="text-sm text-gray-600 ml-2">
                              {numberOfUnits} {numberOfUnits === 1 ? 'unit' : 'units'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            {SERVICES.find(s => s.id === watchedValues.serviceType)?.basePrice === 0 
                              ? `$${SERVICES.find(s => s.id === watchedValues.serviceType)?.pricePerUnit} per unit`
                              : 'Flat rate service'}
                          </p>
                        </div>

                        <h3 className="text-lg font-semibold mb-4">Add-ons (Optional)</h3>
                        <div className="space-y-2">
                          {ADD_ONS.map((addon) => (
                            <label
                              key={addon.id}
                              className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
                            >
                              <input
                                type="checkbox"
                                {...register('addOns')}
                                value={addon.id}
                                className="mr-3"
                              />
                              <div className="flex-1">
                                <p className="font-medium">{addon.name}</p>
                                <p className="text-sm text-gray-600">{addon.description}</p>
                              </div>
                              <span className="font-semibold">+${addon.price}</span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Step 2: Address */}
                {currentStep === 2 && (
                  <div className="mt-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Where should we service your aircon?</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Full Address *
                        </label>
                        <input
                          {...register('address', { required: true })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                          placeholder="Enter your address"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Postal Code *
                        </label>
                        <input
                          {...register('postalCode', { 
                            required: true,
                            pattern: /^\d{6}$/
                          })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                          placeholder="123456"
                          maxLength={6}
                        />
                        {errors.postalCode && (
                          <p className="text-red-600 text-sm mt-1">Please enter a valid 6-digit postal code</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Additional Notes (Optional)
                        </label>
                        <textarea
                          {...register('notes')}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                          rows={3}
                          placeholder="Gate code, parking instructions, etc."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Schedule */}
                {currentStep === 3 && (
                  <div className="mt-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">When would you like the service?</h2>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Select Date *
                        </label>
                        <div className="grid grid-cols-5 md:grid-cols-7 gap-2">
                          {availableDates.slice(0, 14).map((date) => (
                            <button
                              key={date.toISOString()}
                              type="button"
                              onClick={() => {
                                setSelectedDate(date);
                                setValue('date', date);
                              }}
                              className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                                selectedDate?.toDateString() === date.toDateString()
                                  ? 'bg-primary-600 text-white border-primary-600'
                                  : 'bg-white border-gray-300 hover:border-primary-400'
                              }`}
                            >
                              <div>{format(date, 'EEE')}</div>
                              <div className="text-lg">{format(date, 'd')}</div>
                              <div className="text-xs">{format(date, 'MMM')}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      {selectedDate && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            Select Time Slot *
                          </label>
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
                              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                                {TIME_SLOTS.map((slot) => {
                                  const unavailable = isSlotUnavailable(slot.time);
                                  return (
                                    <button
                                      key={slot.time}
                                      type="button"
                                      onClick={() => {
                                        if (!unavailable) setValue('timeSlot', slot.time);
                                      }}
                                      disabled={unavailable}
                                      className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                                        unavailable
                                          ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-50 line-through'
                                          : watchedValues.timeSlot === slot.time
                                            ? 'bg-primary-600 text-white border-primary-600'
                                            : 'bg-white border-gray-300 hover:border-primary-400'
                                      }`}
                                    >
                                      {slot.label}
                                      {unavailable && (
                                        <div className="text-xs mt-1 no-underline" style={{ textDecoration: 'none' }}>Unavailable</div>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 4: Contact */}
                {currentStep === 4 && (
                  <div className="mt-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Your contact details</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Full Name *
                        </label>
                        <input
                          {...register('name', { required: true })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email *
                        </label>
                        <input
                          type="email"
                          {...register('email', { required: true })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Phone Number *
                        </label>
                        <input
                          {...register('phone', { 
                            required: true,
                            pattern: /^\d{8}$/
                          })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                          placeholder="12345678"
                          maxLength={8}
                        />
                        {errors.phone && (
                          <p className="text-red-600 text-sm mt-1">Please enter a valid 8-digit phone number</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5: Review */}
                {currentStep === 5 && (
                  <div className="mt-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Review your booking</h2>
                    <div className="space-y-6">
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h3 className="font-semibold mb-4">Service Details</h3>
                        <div className="space-y-2 text-sm">
                          <p><span className="font-medium">Service:</span> {SERVICES.find(s => s.id === watchedValues.serviceType)?.name}</p>
                          <p><span className="font-medium">Units:</span> {numberOfUnits}</p>
                          {watchedValues.addOns && watchedValues.addOns.length > 0 && (
                            <p><span className="font-medium">Add-ons:</span> {watchedValues.addOns.map(id => ADD_ONS.find(a => a.id === id)?.name).join(', ')}</p>
                          )}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h3 className="font-semibold mb-4">Schedule</h3>
                        <div className="space-y-2 text-sm">
                          <p><span className="font-medium">Date:</span> {watchedValues.date ? format(watchedValues.date, 'MMMM d, yyyy') : 'Not selected'}</p>
                          <p><span className="font-medium">Time:</span> {TIME_SLOTS.find(s => s.time === watchedValues.timeSlot)?.label || 'Not selected'}</p>
                        </div>
                      </div>
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h3 className="font-semibold mb-4">Address</h3>
                        <p className="text-sm">{watchedValues.address}</p>
                        <p className="text-sm">Singapore {watchedValues.postalCode}</p>
                      </div>
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h3 className="font-semibold mb-4">Payment Method</h3>
                        <select
                          {...register('paymentMethod', { required: true })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Credit/Debit Card</option>
                          <option value="paynow">PayLah/PayNow</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="cheque">Cheque</option>
                        </select>
                      </div>
                      {penaltyStatus && parseFloat(penaltyStatus.pending_penalty_fee) > 0 && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-yellow-800">
                            Note: You have a pending penalty of ${penaltyStatus.pending_penalty_fee} from previous cancellations. This will be included in your total.
                          </p>
                        </div>
                      )}
                      <div className="bg-primary-50 p-6 rounded-xl border-2 border-primary-200">
                        {(() => {
                          const service = SERVICES.find(s => s.id === watchedValues.serviceType);
                          const serviceCost = service
                            ? (service.basePrice > 0 ? service.basePrice : service.pricePerUnit * numberOfUnits)
                            : 0;
                          const addOnsCost = ADD_ONS
                            .filter(addon => watchedValues.addOns?.includes(addon.id))
                            .reduce((sum, addon) => sum + addon.price, 0);
                          const penaltyFee = penaltyStatus && parseFloat(penaltyStatus.pending_penalty_fee) > 0
                            ? parseFloat(penaltyStatus.pending_penalty_fee)
                            : 0;
                          return (
                            <>
                              <div className="space-y-1 text-sm mb-3">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Service cost</span>
                                  <span className="text-gray-900">S${serviceCost}</span>
                                </div>
                                {addOnsCost > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Add-ons</span>
                                    <span className="text-gray-900">S${addOnsCost}</span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Travel fee</span>
                                  <span className="text-gray-900">S${TRAVEL_FEE}</span>
                                </div>
                                {penaltyFee > 0 && (
                                  <div className="flex justify-between text-red-700">
                                    <span>Penalty fee</span>
                                    <span>S${penaltyFee.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                              <div className="border-t border-primary-200 pt-2 flex justify-between items-center">
                                <span className="text-base font-semibold text-gray-900">Total Estimated Cost</span>
                                <span className="text-3xl font-bold text-primary-600">S${calculateTotal()}</span>
                              </div>
                            </>
                          );
                        })()}
                        <p className="text-xs text-gray-600 mt-2">* Final cost may vary based on actual service required</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-10 pt-6 border-t border-gray-200">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="text-gray-600"
                >
                  ← Back
                </Button>
                {currentStep < STEPS.length ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    disabled={!canProceed()}
                    className="min-w-[120px]"
                  >
                    Continue →
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    isLoading={loading}
                    disabled={!canProceed()}
                    className="min-w-[160px] bg-primary-600 hover:bg-primary-700"
                  >
                    Confirm Booking
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function BookPage() {
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
      <BookPageContent />
    </Suspense>
  );
}
