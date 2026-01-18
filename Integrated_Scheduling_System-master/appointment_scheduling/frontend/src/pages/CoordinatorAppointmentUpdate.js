import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, Select, message, Modal, Input } from "antd";

const { TextArea } = Input;

function CoordinatorAppointmentUpdate() {
    const [loading, setLoading] = useState(true);
    const [updatedAppointment, setUpdatedAppointment] = useState({});
    const [technicians, setTechnicians] = useState([]);
    const [selectedTechnicianId, setSelectedTechnicianId] = useState(null);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancellationReason, setCancellationReason] = useState('');
    const apptId = new URLSearchParams(window.location.search).get('id');
    const { Option } = Select;

    const statusOptions = [
        { value: '1', label: 'Pending' },
        { value: '2', label: 'Confirmed' },
        { value: '3', label: 'Completed' },
        { value: '4', label: 'Cancelled' },
    ];

    function formatUnixTimestamp(unixTimestamp) {
        const date = new Date(unixTimestamp*1000);
        return date.toLocaleString();
    }

    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/appointments/${apptId}/`);
                setUpdatedAppointment(response.data);
                setSelectedTechnicianId(response.data.technicianId || null);
                setSelectedStatus(response.data.appointmentStatus);
                console.log("Appt:", response.data);
            } catch (error) {
                console.error('Error fetching appointment data:', error);
            } finally {
                setLoading(false);
            }
        };

        const fetchTechnicians = async () => {
            try {
                const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/technicians/`);
                setTechnicians(response.data);
                console.log("Tech: ", response.data);
            } catch (error) {
                console.error('Error fetching technicians:', error);
            }
        };

        fetchAppointments();
        fetchTechnicians();
    }, [apptId]);

    const handleTechnicianChange = (value) => {
        setSelectedTechnicianId(value);
        // Update display name for UI
        if (value === null) {
            setUpdatedAppointment((prev) => ({
                ...prev,
                display: { ...prev.display, technicianName: null },
            }));
        } else {
            const selectedTech = technicians.find(t => t.id === value);
            setUpdatedAppointment((prev) => ({
                ...prev,
                display: { ...prev.display, technicianName: selectedTech?.technicianName },
            }));
        }
    };

    const handleStatusChange = (value) => {
        if (value === '4') {
            // Show cancellation modal
            setShowCancelModal(true);
        } else {
            setSelectedStatus(value);
        }
    };

    const handleCancelModalOk = () => {
        if (!cancellationReason || cancellationReason.trim() === '') {
            message.error('Please provide a reason for cancellation.');
            return;
        }
        setSelectedStatus('4');
        setShowCancelModal(false);
    };

    const handleCancelModalCancel = () => {
        setShowCancelModal(false);
        setCancellationReason('');
    };

    const handleUpdate = async () => {
        try {
            const updateData = {};

            // Only include technician if it changed
            if (selectedTechnicianId !== updatedAppointment.technicianId) {
                updateData.technicianId = selectedTechnicianId;
            }

            // Only include status if it changed
            if (selectedStatus !== updatedAppointment.appointmentStatus) {
                updateData.appointmentStatus = selectedStatus;

                // If cancelling, include reason
                if (selectedStatus === '4') {
                    updateData.cancellationReason = cancellationReason;
                    updateData.cancelledBy = 'coordinator';
                }
            }

            // Don't send empty update
            if (Object.keys(updateData).length === 0) {
                message.info('No changes to save');
                return;
            }

            console.log('Updating with data:', updateData);

            await axios.patch(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/appointments/${apptId}/`, updateData);

            message.success('Appointment updated successfully');
            setTimeout(() => {
                window.location.href = '/CoordinatorHome';
            }, 1000);
        } catch (error) {
            console.error('Error updating appointment:', error);
            if (error.response?.data?.error) {
                message.error(error.response.data.error);
            } else {
                message.error('Failed to update appointment');
            }
        }
    };

    const renderLoading = () => <p>Loading...</p>;

    const getTechnicianStatusBadge = (technician) => {
        const isAvailable = technician.technicianStatus === '1';
        return (
            <span style={{
                marginLeft: 8,
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 4,
                backgroundColor: isAvailable ? '#52c41a' : '#ff4d4f',
                color: 'white'
            }}>
                {isAvailable ? 'Available' : 'Unavailable'}
            </span>
        );
    };

    const renderAppointmentUpdateForm = () => (
        <div className="flex p-5 items-center justify-center">
            <div className="p-6 m-20 bg-white rounded-xl shadow-md" style={{ minWidth: 500 }}>
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Update Appointment</h2>
                <form>
                    {/* Customer and Technician row */}
                    <div className="mb-4 flex w-full content-between">
                        <div className="w-3/6 mr-2">
                            <label className="block mb-2 text-sm font-bold text-gray-700">
                                Customer:
                            </label>
                            <input
                                type="text"
                                value={updatedAppointment.display?.customerName || ''}
                                className="w-full p-2 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-300"
                                disabled
                            />
                        </div>

                        <div className="w-3/6">
                            <label className='block mb-2 text-sm font-bold text-gray-700'>
                                Technician:
                            </label>
                            <Select
                                value={selectedTechnicianId}
                                onChange={handleTechnicianChange}
                                loading={loading}
                                style={{ width: '100%' }}
                                placeholder="Select a technician"
                                allowClear
                            >
                                <Option value={null}>
                                    <span style={{ color: '#999' }}>-- Unassigned --</span>
                                </Option>
                                {technicians.map((technician) => (
                                    <Option key={technician.id} value={technician.id}>
                                        {technician.technicianName}
                                        {getTechnicianStatusBadge(technician)}
                                    </Option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    {/* Status and DateTime row */}
                    <div className="mb-4 flex w-full content-between">
                        <div className="w-3/6 mr-2">
                            <label className='block mb-2 text-sm font-bold text-gray-700'>
                                Appointment Status:
                            </label>
                            <Select
                                value={selectedStatus}
                                onChange={handleStatusChange}
                                style={{ width: '100%' }}
                            >
                                {statusOptions.map((option) => (
                                    <Option key={option.value} value={option.value}>
                                        {option.label}
                                    </Option>
                                ))}
                            </Select>
                        </div>
                        <div className="w-3/6">
                            <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="date-time">
                                Date/Time
                            </label>
                            <input
                                className="w-full p-2 leading-tight text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-300"
                                id="date-time"
                                type="text"
                                value={formatUnixTimestamp(updatedAppointment.appointmentStartTime)}
                                disabled
                            />
                        </div>
                    </div>

                    {/* Payment Method */}
                    {updatedAppointment.display?.paymentMethod && (
                        <div className="mb-4">
                            <label className="block mb-2 text-sm font-bold text-gray-700">
                                Payment Method:
                            </label>
                            <input
                                type="text"
                                value={updatedAppointment.display.paymentMethod}
                                className="w-full p-2 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-300"
                                disabled
                            />
                        </div>
                    )}

                    {/* Aircons to service */}
                    <fieldset className="mb-4">
                        <legend className="block mb-2 text-sm font-bold text-gray-700">Aircons to service</legend>
                        {updatedAppointment.display?.airconToService?.map((airconName, index) => (
                            <div key={index} className="mb-2 text-gray-900 text-sm">
                                <input
                                    type="checkbox"
                                    className="mr-2"
                                    checked
                                    disabled
                                />
                                <label className="text-sm text-gray-700">
                                    {airconName}
                                    {updatedAppointment.display.airconBrand?.[index] &&
                                        ` [${updatedAppointment.display.airconBrand[index]} | ${updatedAppointment.display.airconModel?.[index] || 'N/A'}]`
                                    }
                                </label>
                            </div>
                        ))}
                    </fieldset>

                    {/* Feedback section */}
                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="feedback">
                            Customer Feedback
                        </label>
                        <textarea
                            className="w-full p-2 leading-tight text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300"
                            id="feedback"
                            placeholder="No feedback"
                            value={updatedAppointment.customerFeedback || ''}
                            disabled
                        />
                    </div>

                    {/* Existing cancellation reason if cancelled */}
                    {updatedAppointment.cancellationReason && (
                        <div className="mb-4">
                            <label className="block mb-2 text-sm font-bold text-gray-700">
                                Cancellation Reason
                            </label>
                            <div className="w-full p-2 text-sm text-gray-700 bg-red-50 rounded-lg border border-red-300">
                                {updatedAppointment.cancellationReason}
                            </div>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-2 mt-6">
                        <Button type="primary" onClick={handleUpdate}>
                            Save Changes
                        </Button>
                        <Button href={'/CoordinatorHome'}>
                            Back
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );

    return (
        <div className="w-full h-full bg-gray-100">
            <div className="flex p-5 items-center justify-center">
                {loading ? renderLoading() : renderAppointmentUpdateForm()}
            </div>

            {/* Cancellation Modal */}
            <Modal
                title="Cancel Appointment"
                open={showCancelModal}
                onOk={handleCancelModalOk}
                onCancel={handleCancelModalCancel}
                okText="Confirm"
                okButtonProps={{ danger: true }}
            >
                <div className="mb-4">
                    <label className="block mb-2 text-sm font-bold text-gray-700">
                        Please provide a reason for cancellation:
                    </label>
                    <TextArea
                        rows={4}
                        placeholder="Enter cancellation reason (required)"
                        value={cancellationReason}
                        onChange={(e) => setCancellationReason(e.target.value)}
                        maxLength={500}
                    />
                </div>
            </Modal>
        </div>
    );
}

export default CoordinatorAppointmentUpdate;
