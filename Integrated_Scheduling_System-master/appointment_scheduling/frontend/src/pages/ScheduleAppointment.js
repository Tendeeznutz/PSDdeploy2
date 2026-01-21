import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Progress } from 'antd';

// Pricing constants
const SERVICE_COST_PER_AIRCON = 50; // $50 per aircon serviced
const TRAVEL_FEE = 10; // $10 standard travel fee

function ScheduleAppointment() {
    const customer_id = localStorage.getItem("customers_id");
    const [dateTime, setDateTime] = useState('');
    const [selectedAircons, setSelectedAircons] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [error, setError] = useState('');
    const [userAirconList, setUserAirconList] = useState([]);
    const [progress, setProgress] = useState(0);
    const [showProgress, setShowProgress] = useState(false);
    const navigate = useNavigate();

    const paymentMethods = [
        { value: 'cash', label: 'Cash' },
        { value: 'cheque', label: 'Cheque' },
        { value: 'card', label: 'Credit/Debit Card' },
        { value: 'bank_transfer', label: 'Bank Transfer' },
        { value: 'paynow', label: 'PayLah/PayNow' },
    ];

    // Calculate total cost based on selected aircons
    const calculateTotalCost = () => {
        if (selectedAircons.length === 0) return 0;
        const serviceCost = selectedAircons.length * SERVICE_COST_PER_AIRCON;
        return serviceCost + TRAVEL_FEE;
    };

    const fetchUserAirconData = async () => {
        try {
            const userAirconResponse = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/customeraircondevices/?customerId=${customer_id}`);
            return userAirconResponse.data;
        } catch (error) {
            console.error('Error fetching aircon data:', error);
        }
    };

    useEffect(() => {
        fetchUserAirconData().then((response) => { setUserAirconList(response) });
    }, []);

    const handleAirconChange = (airconName) => {
        console.log('Aircon changed:', airconName);
        setSelectedAircons(prevSelectedAircons => {
            if (prevSelectedAircons.includes(airconName)) {
                return prevSelectedAircons.filter(name => name !== airconName);
            } else {
                return [...prevSelectedAircons, airconName];
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setShowProgress(true);

        try {
            if (!dateTime || selectedAircons.length === 0) {
                throw new Error('Please fill in all fields.');
            }

            const singaporeDateTimeUnix = dateTime.getTime() / 1000;

            const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/appointments/`, {
                customerId: customer_id,
                appointmentStartTime : singaporeDateTimeUnix,
                airconToService : selectedAircons,
                paymentMethod: paymentMethod
            });

            if (response.status === 201) {
                setProgress(100);
                
                setTimeout(() => {
                    navigate('/home');
                }, 1000);
            }

        }
        catch (error) {
            setShowProgress(false);
            console.error('Error scheduling appointment:', error.response);
            if (error.message === "Please fill in all fields.")
            {
                setError(error.message);
            } else if (error.response.data.appointmentStartTime) {
                setError("Scheduled Date cannot be past or present.");
            } else if (error.status === 500) {
                setError("An error have occured at the server. Please try again.");
            } else {
                setError("An error occurred. Please try again.");
            }
        }

    };


    return (
        <div className="w-full h-full bg-gray-100">

            {/* Schedule Appointment Form */}
            <div className="flex p-5 items-center justify-center">
                <div className="p-6 m-40 bg-white rounded-xl shadow-md">
                    <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Schedule Appointment</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="date-time">
                                Date/Time
                            </label>
                            <DatePicker
                                id="date-time"
                                selected={dateTime}
                                onChange={(date) => setDateTime(date)}
                                showTimeSelect
                                timeFormat="HH:mm"
                                timeIntervals={30}
                                timeCaption="time"
                                dateFormat="MMM d, yyyy h:mm aa"
                                className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <fieldset className="mb-4">
                            <legend className="block mb-2 text-sm font-bold text-gray-700">Select Aircon(s)</legend>
                            {userAirconList.length > 0 ? (
                                userAirconList.map((aircon) => (
                                    <div key={aircon.id} className="mb-2">
                                        <input
                                            type="checkbox"
                                            id={aircon.airconName}
                                            value={aircon.airconName}
                                            checked={selectedAircons.includes(aircon.id)}
                                            onChange={() => handleAirconChange(aircon.id)}
                                            className="mr-2"
                                        />
                                        <label htmlFor={aircon.airconName} className="text-sm text-gray-700">{aircon.airconName}</label>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-700">User does not have any aircon</p>
                            )}
                        </fieldset>
                        <div className="mb-4">
                            <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="payment-method">
                                Payment Method
                            </label>
                            <select
                                id="payment-method"
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                            >
                                {paymentMethods.map((method) => (
                                    <option key={method.value} value={method.value}>
                                        {method.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Cost Summary */}
                        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h3 className="text-sm font-bold text-blue-800 mb-2">Cost Summary</h3>
                            <div className="text-sm text-blue-700">
                                <div className="flex justify-between mb-1">
                                    <span>Service Fee ({selectedAircons.length} aircon{selectedAircons.length !== 1 ? 's' : ''} x ${SERVICE_COST_PER_AIRCON})</span>
                                    <span>${selectedAircons.length * SERVICE_COST_PER_AIRCON}.00</span>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span>Travel Fee</span>
                                    <span>${TRAVEL_FEE}.00</span>
                                </div>
                                <hr className="my-2 border-blue-300" />
                                <div className="flex justify-between font-bold text-blue-900">
                                    <span>Total</span>
                                    <span>${calculateTotalCost()}.00</span>
                                </div>
                            </div>
                            <p className="text-xs text-blue-600 mt-2">* A receipt will be sent to your mailbox upon booking confirmation</p>
                        </div>

                        <div className="flex items-center justify-center">
                            {userAirconList.length > 0 ? (
                                <button
                                    className="px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700 focus:outline-none focus:shadow-outline"
                                    type="submit"
                                >
                                    Book Appointment
                                </button>
                            ) : (
                                <button
                                    className="px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700 focus:outline-none focus:shadow-outline"
                                    type="button"
                                    onClick={() => navigate('/profile')}
                                >
                                    To  profile
                                </button>
                            
                            )}
                        </div>
                        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                    </form>
                    {showProgress && <Progress className="mt-3" percent={progress} type="line" />}
                </div>
            </div>
        </div>
    );


}

export default ScheduleAppointment;
