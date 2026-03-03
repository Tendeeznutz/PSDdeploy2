import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from "../axiosConfig";
import { Button } from "antd";

function CoordinatorAppointmentView() {
    const [appointment, setAppointment] = useState([]);
    const [loading, setLoading] = useState(true);
    const [airconData, setAirconData] = useState([]);
    const [customerName, setCustomerName] = useState('');
    const [technicianName, setTechnicianName] = useState('');
    const [appointmentStatus, setAppointmentStatus] = useState('');
    const apptId = new URLSearchParams(window.location.search).get('id');
    const navigate = useNavigate();


    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                const response = await api.get(`/api/appointments/${apptId}/`);
                setAppointment(response.data);
            } catch (error) {
                console.error('Error fetching appointment data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAppointments();
    }, []);

    function formatUnixTimestamp(unixTimestamp) {
        // Create a new Date object
        const date = new Date(unixTimestamp*1000);
        // Format the date as a string
        return date.toLocaleString();
    }

    const renderLoading = () => <p>Loading...</p>;

    const renderAppointmentDetails = () => (
        <div className="flex p-5 items-center justify-center">
            <div className="p-6 m-40 bg-white rounded-xl shadow-md w-4/5">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Appointment Details</h2>
                <form>
                    <div className="mb-4 flex w-full content-beween">
                        <div className="w-3/6 mr-2">
                            <label className="block mb-2 text-sm font-bold text-gray-700">
                                Customer:
                            </label>
                            <input
                                type="text"
                                value={appointment.display['customerName']}
                                className="w-full p-2 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                disabled
                            />
                        </div>

                        <div className="w-3/6">
                            <label className='block mb-2 text-sm font-bold text-gray-700'>
                                Technician:
                            </label>
                            <input
                                type="text"
                                value={appointment.display['technicianName']}
                                className="w-full p-2 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                disabled
                            />
                        </div>
                    </div>

                    {/* Render appointment status and datetime section */}
                    <div className="mb-4 flex w-full content-between">
                        <div className="w-4/6 mr-2">
                            <label className='block mb-2 text-sm font-bold text-gray-700'>
                                Appointment Status:
                            </label>
                            <input
                                type="text"
                                value={appointment.display['appointmentStatus']}
                                className="w-full p-2 leading-tight text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                disabled
                            />
                        </div>
                        <div className="w-2/6">
                            <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="date-time">
                                Date/Time
                            </label>
                            <input
                                className="w-full p-2 leading-tight text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                id="date-time"
                                type="text"
                                value={formatUnixTimestamp(appointment.appointmentStartTime)}
                                disabled
                            />
                        </div>
                    </div>

                    {/*/!* Render selected aircon section *!/*/}
                    <fieldset className="mb-4">
                        <legend className="block mb-2 text-sm font-bold text-gray-700">Aircons to service</legend>
                        {appointment.display['airconBrand'].map((aircon, index) => (
                            <div key={index} className="mb-2 text-gray-900 text-sm">
                                <input
                                    type="checkbox"
                                    id={aircon}
                                    value={aircon}
                                    className="mr-2"
                                    checked
                                    disabled
                                />
                                <label htmlFor={aircon} className="text-sm text-gray-700">
                                    {aircon} [{appointment.display['airconBrand'][index]} | {appointment.display['airconModel'][index]}]
                                </label>
                            </div>
                        ))}
                    </fieldset>

                    {/* Render feedback section */}
                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="feedback">
                            Feedback
                        </label>
                        <textarea
                            className="w-full p-2 leading-tight text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                            id="feedback"
                            type="text"
                            placeholder="Feedback"
                            value={appointment.customerFeedback}
                            disabled
                        />
                    </div>
                    <Button href={'/CoordinatorHome'}>Back</Button>
                </form>
            </div>
        </div>
    );

    return (
        <div className="w-full h-full bg-gray-100">
            <div className="flex p-5 items-center justify-center">
                {loading ? renderLoading() : renderAppointmentDetails()}
            </div>
        </div>
    );

}

export default CoordinatorAppointmentView;
