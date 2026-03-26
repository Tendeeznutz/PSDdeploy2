import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker, InputNumber, Radio, TimePicker, message } from 'antd';
import dayjs from 'dayjs';

import api from '../axiosConfig';
import OwnedCard from '../components/ui/OwnedCard';
import OwnedPageHeader from '../components/ui/OwnedPageHeader';
import OwnedPageShell from '../components/ui/OwnedPageShell';

function GuestBooking() {
    const [bookingData, setBookingData] = useState({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        customerAddress: '',
        customerPostalCode: '',
        airconBrand: '',
        airconModel: '',
        numberOfUnits: 1,
        paymentMethod: 'cash',
    });
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    const airconBrands = ['Daikin', 'Mitsubishi', 'Panasonic', 'LG', 'Samsung', 'Fujitsu', 'Sharp', 'Toshiba', 'Hitachi', 'York', 'Other'];
    const paymentMethods = [
        { value: 'cash', label: 'Cash' },
        { value: 'cheque', label: 'Cheque' },
        { value: 'card', label: 'Credit / Debit Card' },
        { value: 'paynow', label: 'PayLah / PayNow' },
        { value: 'bank_transfer', label: 'Bank Transfer' },
    ];

    const serviceFee = bookingData.numberOfUnits * 50;
    const travelFee = 10;
    const totalCost = serviceFee + travelFee;

    const handleInputChange = (field, value) => {
        setBookingData((currentData) => ({ ...currentData, [field]: value }));
        setErrorMessage('');
    };

    const validateForm = () => {
        const {
            customerName, customerPhone, customerEmail, customerAddress, customerPostalCode, airconBrand,
        } = bookingData;

        if (!customerName || !customerPhone || !customerEmail || !customerAddress || !customerPostalCode || !airconBrand) {
            setErrorMessage('Please fill in all required fields.');
            return false;
        }

        const phoneRegex = /^(6|8|9)\d{7}$/;
        if (!phoneRegex.test(customerPhone)) {
            setErrorMessage('Please enter a valid Singapore phone number.');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerEmail)) {
            setErrorMessage('Please enter a valid email address.');
            return false;
        }

        const postalRegex = /^\d{6}$/;
        if (!postalRegex.test(customerPostalCode)) {
            setErrorMessage('Please enter a valid 6-digit Singapore postal code.');
            return false;
        }

        if (!selectedDate || !selectedTime) {
            setErrorMessage('Please select your preferred booking date and time.');
            return false;
        }

        return true;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setErrorMessage('');

        try {
            const appointmentTimestamp = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${selectedTime.format('HH:mm')}`).unix();
            const payload = {
                customerName: bookingData.customerName,
                customerPhone: bookingData.customerPhone,
                customerEmail: bookingData.customerEmail,
                customerAddress: bookingData.customerAddress,
                customerPostalCode: bookingData.customerPostalCode,
                airconBrand: bookingData.airconBrand,
                airconModel: bookingData.airconModel || 'Standard',
                numberOfUnits: bookingData.numberOfUnits,
                appointmentStartTime: appointmentTimestamp,
                paymentMethod: bookingData.paymentMethod,
            };

            const response = await api.post('/api/appointments/guest-booking/', payload);

            if (response.status === 201) {
                message.success('Booking created successfully. Check your email for confirmation.');
                const bookingRef = response.data.appointment?.id?.substring(0, 8).toUpperCase();
                if (bookingRef) {
                    message.info(`Your booking reference is ${bookingRef}.`, 5);
                }

                setBookingData({
                    customerName: '',
                    customerPhone: '',
                    customerEmail: '',
                    customerAddress: '',
                    customerPostalCode: '',
                    airconBrand: '',
                    airconModel: '',
                    numberOfUnits: 1,
                    paymentMethod: 'cash',
                });
                setSelectedDate(null);
                setSelectedTime(null);

                setTimeout(() => {
                    navigate('/');
                }, 2600);
            }
        } catch (submitError) {
            console.error('Booking failed:', submitError);
            if (submitError.response?.data?.error) {
                setErrorMessage(submitError.response.data.error);
            } else {
                setErrorMessage('Failed to create booking. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const disabledDate = (current) => current && current < dayjs().startOf('day');

    return (
        <div className="min-h-screen bg-[#F8F9FA]">
            <OwnedPageShell>
                <OwnedPageHeader
                    eyebrow="Guest booking"
                    title="Quick booking"
                    description="Book a service without creating an account. We will use these details to coordinate your appointment and send your confirmation."
                />

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_320px]">
                    <OwnedCard className="p-5 md:p-6">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <section className="space-y-4">
                                <div>
                                    <h2 className="owned-section-title">Your contact details</h2>
                                    <p className="owned-section-copy">We use these details to confirm your booking and keep you updated.</p>
                                </div>
                                <div className="owned-form-grid">
                                    <div className="owned-field">
                                        <label className="owned-field__label" htmlFor="guest-name">Full name</label>
                                        <input id="guest-name" value={bookingData.customerName} onChange={(event) => handleInputChange('customerName', event.target.value)} className="owned-input w-full px-3 py-2 text-sm text-[#22252E] bg-white border" placeholder="John Doe" />
                                    </div>
                                    <div className="owned-field">
                                        <label className="owned-field__label" htmlFor="guest-phone">Phone number</label>
                                        <input id="guest-phone" value={bookingData.customerPhone} onChange={(event) => handleInputChange('customerPhone', event.target.value)} className="owned-input w-full px-3 py-2 text-sm text-[#22252E] bg-white border" placeholder="91234567" />
                                    </div>
                                    <div className="owned-field">
                                        <label className="owned-field__label" htmlFor="guest-email">Email address</label>
                                        <input id="guest-email" type="email" value={bookingData.customerEmail} onChange={(event) => handleInputChange('customerEmail', event.target.value)} className="owned-input w-full px-3 py-2 text-sm text-[#22252E] bg-white border" placeholder="name@email.com" />
                                    </div>
                                    <div className="owned-field">
                                        <label className="owned-field__label" htmlFor="guest-postal">Postal code</label>
                                        <input id="guest-postal" value={bookingData.customerPostalCode} onChange={(event) => handleInputChange('customerPostalCode', event.target.value)} className="owned-input w-full px-3 py-2 text-sm text-[#22252E] bg-white border" placeholder="123456" />
                                    </div>
                                </div>
                                <div className="owned-field">
                                    <label className="owned-field__label" htmlFor="guest-address">Address</label>
                                    <input id="guest-address" value={bookingData.customerAddress} onChange={(event) => handleInputChange('customerAddress', event.target.value)} className="owned-input w-full px-3 py-2 text-sm text-[#22252E] bg-white border" placeholder="123 Main Street #01-01" />
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div>
                                    <h2 className="owned-section-title">Service details</h2>
                                    <p className="owned-section-copy">Tell us what kind of aircon unit needs attention.</p>
                                </div>
                                <div className="owned-form-grid">
                                    <div className="owned-field">
                                        <label className="owned-field__label" htmlFor="guest-brand">Aircon brand</label>
                                        <select id="guest-brand" value={bookingData.airconBrand} onChange={(event) => handleInputChange('airconBrand', event.target.value)} className="owned-input w-full px-3 py-2 text-sm text-[#22252E] bg-white border">
                                            <option value="">Select a brand</option>
                                            {airconBrands.map((brand) => (
                                                <option key={brand} value={brand}>{brand}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="owned-field">
                                        <label className="owned-field__label" htmlFor="guest-model">Aircon model</label>
                                        <input id="guest-model" value={bookingData.airconModel} onChange={(event) => handleInputChange('airconModel', event.target.value)} className="owned-input w-full px-3 py-2 text-sm text-[#22252E] bg-white border" placeholder="Optional" />
                                    </div>
                                </div>
                                <div className="owned-field">
                                    <label className="owned-field__label" htmlFor="guest-units">Number of units</label>
                                    <InputNumber
                                        id="guest-units"
                                        size="large"
                                        min={1}
                                        max={10}
                                        value={bookingData.numberOfUnits}
                                        onChange={(value) => handleInputChange('numberOfUnits', value || 1)}
                                        className="owned-input w-full"
                                        style={{ width: '100%' }}
                                    />
                                    <span className="owned-field__hint">$50 service fee per unit plus a standard $10 travel fee.</span>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div>
                                    <h2 className="owned-section-title">Preferred schedule and payment</h2>
                                    <p className="owned-section-copy">Choose a preferred slot. We will use it when coordinating the booking.</p>
                                </div>
                                <div className="owned-form-grid">
                                    <div className="owned-field">
                                        <label className="owned-field__label">Preferred date</label>
                                        <DatePicker size="large" value={selectedDate} onChange={setSelectedDate} disabledDate={disabledDate} format="YYYY-MM-DD" className="owned-input w-full" placeholder="Select date" />
                                    </div>
                                    <div className="owned-field">
                                        <label className="owned-field__label">Preferred time</label>
                                        <TimePicker
                                            size="large"
                                            value={selectedTime}
                                            onChange={setSelectedTime}
                                            format="HH:mm"
                                            className="owned-input w-full"
                                            popupClassName="owned-time-picker-popup"
                                            placeholder="Select time"
                                            minuteStep={30}
                                            disabledHours={() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 19, 20, 21, 22, 23]}
                                            hideDisabledOptions
                                        />
                                    </div>
                                </div>

                                <div className="owned-field">
                                    <label className="owned-field__label">Payment method</label>
                                    <Radio.Group
                                        value={bookingData.paymentMethod}
                                        onChange={(event) => handleInputChange('paymentMethod', event.target.value)}
                                        className="owned-radio-grid grid gap-3 sm:grid-cols-2"
                                    >
                                        {paymentMethods.map((method) => (
                                            <Radio.Button key={method.value} value={method.value} className="text-left">
                                                <span className="block font-semibold text-[#22252E]">{method.label}</span>
                                                <span className="mt-1 block text-sm text-[#6B7280]">
                                                    {bookingData.paymentMethod === method.value ? 'Selected for this booking' : 'Tap to choose this option'}
                                                </span>
                                            </Radio.Button>
                                        ))}
                                    </Radio.Group>
                                </div>
                            </section>

                            {errorMessage ? (
                                <div className="owned-inline-note border-red-200 bg-red-50 text-[#9F3A38]">{errorMessage}</div>
                            ) : null}

                            <div className="owned-action-row pt-2">
                                <button type="button" className="owned-secondary-button px-4 py-2" onClick={() => navigate('/login')}>
                                    Back to login
                                </button>
                                <button type="submit" className={`owned-primary-button px-5 py-2.5 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`} disabled={loading}>
                                    {loading ? 'Creating booking...' : 'Book appointment'}
                                </button>
                            </div>
                        </form>
                    </OwnedCard>

                    <div className="space-y-6">
                        <OwnedCard className="owned-summary-card">
                            <p className="text-sm font-semibold uppercase tracking-wide text-[#4F81BD]">Estimated total</p>
                            <div className="mt-4 space-y-3 text-sm text-[#6B7280]">
                                <div className="flex justify-between gap-4">
                                    <span>Service fee</span>
                                    <span className="font-semibold text-[#22252E]">${serviceFee.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span>Travel fee</span>
                                    <span className="font-semibold text-[#22252E]">${travelFee.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="owned-divider my-4" />
                            <p className="owned-summary-card__price">${totalCost.toFixed(2)}</p>
                            <p className="mt-3 text-sm leading-6 text-[#6B7280]">Your confirmation email will include the booking reference and appointment summary.</p>
                        </OwnedCard>

                        <OwnedCard className="p-5">
                            <p className="text-sm font-semibold text-[#22252E]">Helpful notes</p>
                            <ul className="mt-3 space-y-2 text-sm leading-6 text-[#6B7280]">
                                <li>Choose a future date only.</li>
                                <li>Select the closest aircon brand if you are unsure of the exact model.</li>
                                <li>We keep this flow simple so you can finish the booking quickly.</li>
                            </ul>
                        </OwnedCard>
                    </div>
                </div>
            </OwnedPageShell>
        </div>
    );
}

export default GuestBooking;
