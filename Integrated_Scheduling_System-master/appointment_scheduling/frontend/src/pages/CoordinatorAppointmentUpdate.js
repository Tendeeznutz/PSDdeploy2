import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, Select, message } from "antd";

function CoordinatorAppointmentUpdate() {
    const [loading, setLoading] = useState(true);
    const [updatedAppointment, setUpdatedAppointment] = useState({});
    const [technicians, setTechnicians] = useState([]);
    const apptId = new URLSearchParams(window.location.search).get('id');
    const { Option } = Select;
    function formatUnixTimestamp(unixTimestamp) {
        // Create a new Date object
        const date = new Date(unixTimestamp*1000);
        // Format the date as a string
        return date.toLocaleString();
    }

    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/appointments/${apptId}/`);
                setUpdatedAppointment(response.data);
                console.log("Appt:", response.data);
            } catch (error) {
                console.error('Error fetching appointment data:', error);
            } finally {
                setLoading(false);
            }
        };

        // fetch technicians
        const fetchTechnicians = async () => {
            try {
                const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/technicians/`);
                setTechnicians(response.data);
                console.log("Tech: ", response.data);
            } catch (error) {
                console.error('Error fetching technicians:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAppointments();
        fetchTechnicians();
    }, [apptId]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setUpdatedAppointment({ ...updatedAppointment, [name]: value });
    };


    const handleTechnicianChange = (value) => {
        setUpdatedAppointment((prevAppointment) => ({
            ...prevAppointment,
            display: {
                ...prevAppointment.display,
                technicianName: value,
            },
        }));
    };

    const handleUpdate = async () => {
        const selectedTechnician = technicians.find(technicians => technicians.technicianName === updatedAppointment.display.technicianName);
        console.log('Selected technician:', selectedTechnician);
        try {
            await axios.patch(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/appointments/${apptId}/`, {
                technicianId: selectedTechnician.id,
            });
            console.log('Appointment updated successfully');
            message.success('Appointment updated successfully');
            // Redirect to coordinator home after successful update
            setTimeout(() => {
                window.location.href = '/CoordinatorHome';
            }, 1000);
        } catch (error) {
            console.error('Error updating appointment:', error);
            message.error('Failed to update appointment');
        }
    };

    const renderLoading = () => <p>Loading...</p>;

    const renderAppointmentUpdateForm = () => (
        <div className="flex p-5 items-center justify-center">
            <div className="p-6 m-40 bg-white rounded-xl shadow-md w-90">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Appointment Details</h2>
                <form>
                    <div className="mb-4 flex w-full content-beween">
                        <div className="w-3/6 mr-2">
                            <label className="block mb-2 text-sm font-bold text-gray-700">
                                Customer:
                            </label>
                            <input
                                type="text"
                                value={updatedAppointment.display?.customerName || ''}
                                onChange={handleInputChange}
                                className="w-full p-2 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div className="w-3/6">
                            <label className='block mb-2 text-sm font-bold text-gray-700'>
                                Technician:
                            </label>
                            <Select
                                value={updatedAppointment.display?.technicianName || ''}
                                onChange={handleTechnicianChange}
                                loading={loading}
                                style={{ width: '100%' }}
                            >
                                {technicians.map((technician) => (
                                    <Option key={technician.id} value={technician.technicianName}>
                                        {technician.technicianName}
                                    </Option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    {/* Render appointment status and datetime section */}
                    <div className="mb-4 flex w-full content-between">
                        <div className="w-3/6 mr-2">
                            <label className='block mb-2 text-sm font-bold text-gray-700'>
                                Appointment Status:
                            </label>
                            <input
                                type="text"
                                defaultValue={updatedAppointment.display ? updatedAppointment.display['appointmentStatus'] : ''}
                                className="w-full p-2 leading-tight text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="w-3/6">
                            <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="date-time">
                                Date/Time
                            </label>
                            <input
                                className="w-full p-2 leading-tight text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                id="date-time"
                                type="text"
                                value={formatUnixTimestamp(updatedAppointment.appointmentStartTime)}
                                onChange={handleInputChange}
                            />
                        </div>
                    </div>

                    {/*/!* Render selected aircon section *!/*/}
                    <fieldset className="mb-4">
                        <legend className="block mb-2 text-sm font-bold text-gray-700">Aircons to service</legend>
                        {updatedAppointment.display && updatedAppointment.display['airconBrand'] && updatedAppointment.display['airconBrand'].map((aircon, index) => (
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
                                    {aircon} [{updatedAppointment.display['airconBrand'][index]} | {updatedAppointment.display['airconModel'][index]}]
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
                            placeholder="Customer's Feedback"
                            value={updatedAppointment.customerFeedback || ''}
                            disabled
                        />
                    </div>
                    <Button type="default" style={{color:'blue'}} onClick={handleUpdate}>Update</Button>
                    <Button href={'/CoordinatorHome'}>Back</Button>
                </form>
            </div>
        </div>
    );

    return (
        <div className="w-full h-full bg-gray-100">
            <div className="flex p-5 items-center justify-center">
                {loading ? renderLoading() : renderAppointmentUpdateForm()}
            </div>
        </div>
    );
}

export default CoordinatorAppointmentUpdate;
