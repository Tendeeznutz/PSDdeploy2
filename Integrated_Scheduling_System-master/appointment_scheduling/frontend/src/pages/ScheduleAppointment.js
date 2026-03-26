import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Progress } from 'antd';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import api from '../axiosConfig';
import OwnedCard from '../components/ui/OwnedCard';
import OwnedPageHeader from '../components/ui/OwnedPageHeader';
import OwnedPageShell from '../components/ui/OwnedPageShell';

const SERVICE_COST_PER_AIRCON = 50;
const TRAVEL_FEE = 10;

function ScheduleAppointment() {
    const customerId = localStorage.getItem('customers_id');
    const [dateTime, setDateTime] = useState(null);
    const [timeSelected, setTimeSelected] = useState(false);
    const [selectedAircons, setSelectedAircons] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [error, setError] = useState('');
    const [userAirconList, setUserAirconList] = useState([]);
    const [progress, setProgress] = useState(0);
    const [showProgress, setShowProgress] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    const paymentMethods = [
        { value: 'cash', label: 'Cash' },
        { value: 'cheque', label: 'Cheque' },
        { value: 'card', label: 'Credit / Debit Card' },
        { value: 'bank_transfer', label: 'Bank Transfer' },
        { value: 'paynow', label: 'PayLah / PayNow' },
    ];

    // Calculate total units from selected aircon devices
    const getTotalUnits = () => {
        return selectedAircons.reduce((total, airconId) => {
            const device = userAirconList.find(a => a.id === airconId);
            return total + (device ? device.numberOfUnits : 1);
        }, 0);
    };

    // Calculate total cost based on total units across selected devices
    const calculateTotalCost = () => {
        const totalUnits = getTotalUnits();
        if (totalUnits === 0) return 0;
        const serviceCost = totalUnits * SERVICE_COST_PER_AIRCON;
        return serviceCost + TRAVEL_FEE;
    };

    useEffect(() => {
        const fetchUserAirconData = async () => {
            try {
                const userAirconResponse = await api.get(`/api/customeraircondevices/?customerId=${customerId}`);
                setUserAirconList(userAirconResponse.data || []);
            } catch (fetchError) {
                console.error('Error fetching aircon data:', fetchError);
            }
        };

        fetchUserAirconData();
    }, [customerId]);

    const handleAirconChange = (airconId) => {
        setSelectedAircons((currentSelectedAircons) => (
            currentSelectedAircons.includes(airconId)
                ? currentSelectedAircons.filter((id) => id !== airconId)
                : [...currentSelectedAircons, airconId]
        ));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (isSubmitting) {
            return;
        }

        try {
            if (!dateTime || selectedAircons.length === 0) {
                throw new Error('Please choose at least one aircon unit and an appointment date.');
            }

            if (!timeSelected) {
                throw new Error('Please select a specific time from the date and time picker.');
            }

            const selectedHour = dateTime.getHours();
            if (selectedHour < 8 || selectedHour >= 20) {
                throw new Error('Please select a time between 8:00 AM and 8:00 PM.');
            }

            const appointmentStartTime = Math.floor(dateTime.getTime() / 1000);
            if (appointmentStartTime <= Math.floor(Date.now() / 1000)) {
                throw new Error('Please select an appointment time in the future.');
            }

            setIsSubmitting(true);
            setShowProgress(true);
            setProgress(35);

            const endpoint = '/api/appointments/';
            const payload = {
                customerId,
                appointmentStartTime,
                airconToService: selectedAircons.map((id) => String(id)),
                paymentMethod,
            };

            console.log('Booking payload:', JSON.stringify(payload, null, 2));
            console.log('Posting to:', endpoint);

            const response = await api.post(endpoint, payload);

            if (response.status === 201) {
                setProgress(100);
                setTimeout(() => {
                    navigate('/customer/home');
                }, 900);
            }
        } catch (submitError) {
            setIsSubmitting(false);
            setShowProgress(false);
            console.error('HTTP Status:', submitError.response?.status);
            console.error('Backend said:', JSON.stringify(submitError.response?.data));

            const backendMessage =
                submitError.response?.data?.message
                || submitError.response?.data?.error
                || submitError.response?.data?.appointmentStartTime?.[0]
                || submitError.response?.data?.airconToService?.[0]
                || submitError.response?.data?.customerId?.[0]
                || submitError.response?.data;

            const msg = typeof backendMessage === 'string'
                ? backendMessage
                : submitError.message || 'Booking failed. Please try again.';

            setError(msg);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8F9FA]">
            <OwnedPageShell>
                <OwnedPageHeader
                    eyebrow="Booking"
                    title="Book your service"
                    description="Choose the units to service, confirm your preferred appointment slot, and review the total before submitting."
                />

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_340px]">
                    <OwnedCard className="p-5 md:p-6">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <section className="space-y-4">
                                <div>
                                    <h2 className="owned-section-title">Select the aircon units to service</h2>
                                    <p className="owned-section-copy">Use the saved devices from your profile. You can select more than one unit in the same booking.</p>
                                </div>

                                {userAirconList.length > 0 ? (
                                    <div className="grid gap-3">
                                        {userAirconList.map((aircon) => {
                                            const isSelected = selectedAircons.includes(aircon.id);
                                            return (
                                                <button
                                                    key={aircon.id}
                                                    type="button"
                                                    onClick={() => handleAirconChange(aircon.id)}
                                                    className={`text-left rounded-xl border px-4 py-4 transition ${isSelected ? 'border-[#4F81BD] bg-[#EEF4FB] shadow-sm' : 'border-[#E5E7EB] bg-white hover:border-[#B8C7DA]'}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="font-semibold text-[#22252E]">{aircon.airconName}</p>
                                                            <p className="mt-1 text-sm text-[#6B7280]">
                                                                {aircon.airconType ? `${aircon.airconType} • ` : ''}{aircon.numberOfUnits} unit{aircon.numberOfUnits > 1 ? 's' : ''}
                                                            </p>
                                                        </div>
                                                        <span className={`owned-badge ${isSelected ? 'owned-badge--info' : ''}`}>
                                                            {isSelected ? 'Selected' : 'Tap to select'}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="owned-inline-note">
                                        You do not have any saved aircon devices yet. Add your units in your profile before creating a booking.
                                    </div>
                                )}
                            </section>

                            <section className="space-y-4">
                                <div>
                                    <h2 className="owned-section-title">Choose a preferred appointment time</h2>
                                    <p className="owned-section-copy">Appointments can only be booked between 8:00 AM and 8:00 PM.</p>
                                </div>

                                <div className="owned-form-grid">
                                    <div className="owned-field">
                                        <label className="owned-field__label" htmlFor="customer-booking-datetime">Date and time</label>
                                        <DatePicker
                                            id="customer-booking-datetime"
                                            selected={dateTime}
                                            onChange={(date) => {
                                                if (date) {
                                                    if (dateTime instanceof Date) {
                                                        const dateChanged = date.toDateString() !== dateTime.toDateString();
                                                        const timeChanged = date.getHours() !== dateTime.getHours() || date.getMinutes() !== dateTime.getMinutes();

                                                        if (timeChanged && !dateChanged) {
                                                            setTimeSelected(true);
                                                        }

                                                        if (dateChanged) {
                                                            setTimeSelected(false);
                                                        }
                                                    }
                                                }

                                                setDateTime(date);
                                            }}
                                            showTimeSelect
                                            timeFormat="HH:mm"
                                            timeIntervals={30}
                                            timeCaption="time"
                                            dateFormat="MMM d, yyyy h:mm aa"
                                            minDate={new Date()}
                                            minTime={new Date(new Date().setHours(8, 0, 0))}
                                            maxTime={new Date(new Date().setHours(20, 0, 0))}
                                            className="owned-input w-full px-3 py-2 text-sm text-[#22252E] bg-white border"
                                        />
                                        {dateTime && !timeSelected ? (
                                            <span className="owned-field__hint text-[#946b00]">After choosing a date, pick a specific time from the time list.</span>
                                        ) : null}
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div>
                                    <h2 className="owned-section-title">Confirm payment preference</h2>
                                    <p className="owned-section-copy">This keeps the booking flow clear for the assigned technician and coordinator.</p>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    {paymentMethods.map((method) => {
                                        const isActive = paymentMethod === method.value;
                                        return (
                                            <button
                                                key={method.value}
                                                type="button"
                                                onClick={() => setPaymentMethod(method.value)}
                                                className={`rounded-xl border px-4 py-4 text-left transition ${isActive ? 'border-[#4F81BD] bg-[#EEF4FB]' : 'border-[#E5E7EB] bg-white hover:border-[#B8C7DA]'}`}
                                            >
                                                <p className="font-semibold text-[#22252E]">{method.label}</p>
                                                <p className="mt-1 text-sm text-[#6B7280]">{isActive ? 'Selected for this booking' : 'Tap to choose this option'}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            {error ? (
                                <div className="owned-inline-note border-red-200 bg-red-50 text-[#9F3A38]">{error}</div>
                            ) : null}

                            {showProgress ? <Progress className="mt-2" percent={progress} type="line" strokeColor="#4F81BD" /> : null}

                            <div className="owned-action-row pt-2">
                                <button
                                    type="button"
                                    className="owned-secondary-button px-4 py-2"
                                    onClick={() => navigate(userAirconList.length > 0 ? '/customer/home' : '/customer/profile')}
                                >
                                    {userAirconList.length > 0 ? 'Back to home' : 'Go to profile'}
                                </button>
                                <button
                                    className={`owned-primary-button px-5 py-2.5 ${isSubmitting || userAirconList.length === 0 ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    type="submit"
                                    disabled={isSubmitting || userAirconList.length === 0}
                                >
                                    {isSubmitting ? 'Booking...' : 'Book appointment'}
                                </button>
                            </div>
                        </form>
                    </OwnedCard>

                    <div className="space-y-6">
                        <OwnedCard className="owned-summary-card">
                            <p className="text-sm font-semibold uppercase tracking-wide text-[#4F81BD]">Booking summary</p>
                            <div className="mt-4 space-y-3 text-sm text-[#6B7280]">
                                <div className="flex items-center justify-between gap-4">
                                    <span>Total units</span>
                                    <span className="font-semibold text-[#22252E]">{getTotalUnits()} unit{getTotalUnits() !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span>Service fee ({getTotalUnits()} x ${SERVICE_COST_PER_AIRCON})</span>
                                    <span className="font-semibold text-[#22252E]">${getTotalUnits() * SERVICE_COST_PER_AIRCON}.00</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span>Travel fee</span>
                                    <span className="font-semibold text-[#22252E]">${TRAVEL_FEE}.00</span>
                                </div>
                            </div>
                            <div className="owned-divider my-4" />
                            <p className="text-sm text-[#6B7280]">Estimated total</p>
                            <p className="owned-summary-card__price">${calculateTotalCost()}.00</p>
                            <p className="mt-3 text-sm leading-6 text-[#6B7280]">A receipt will be sent to your mailbox once the booking is confirmed.</p>
                        </OwnedCard>

                        <OwnedCard className="p-5">
                            <p className="text-sm font-semibold text-[#22252E]">Before you submit</p>
                            <ul className="mt-3 space-y-2 text-sm leading-6 text-[#6B7280]">
                                <li>Make sure at least one unit is selected.</li>
                                <li>Choose a date and then a specific appointment time.</li>
                                <li>Bookings follow the validations already enforced by the system.</li>
                            </ul>
                        </OwnedCard>
                    </div>
                </div>
            </OwnedPageShell>
        </div>
    );
}

export default ScheduleAppointment;
