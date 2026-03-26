import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axiosConfig';
import { message, Modal } from 'antd';
import { Input } from 'antd';

const { TextArea } = Input;

const FF = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const LABEL = { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, display: 'block' };
const INPUT_STYLE = { width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, color: '#0f172a', background: 'white', outline: 'none', fontFamily: FF, boxSizing: 'border-box' };
const DISABLED_INPUT = { ...INPUT_STYLE, background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' };
const SELECT_STYLE = { ...INPUT_STYLE, cursor: 'pointer', appearance: 'auto' };

function CoordinatorAppointmentUpdate() {
    const [loading, setLoading] = useState(true);
    const [updatedAppointment, setUpdatedAppointment] = useState({});
    const [technicians, setTechnicians] = useState([]);
    const [selectedTechnicianId, setSelectedTechnicianId] = useState(null);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancellationReason, setCancellationReason] = useState('');
    const apptId = new URLSearchParams(window.location.search).get('id');
    const navigate = useNavigate();

    const statusOptions = [
        { value: '1', label: 'Pending' },
        { value: '2', label: 'Confirmed' },
        { value: '3', label: 'Completed' },
        { value: '4', label: 'Cancelled' },
    ];

    function formatUnixTimestamp(unixTimestamp) {
        const date = new Date(unixTimestamp * 1000);
        return date.toLocaleString();
    }

    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                const response = await api.get(`/api/appointments/${apptId}/`);
                setUpdatedAppointment(response.data);
                setSelectedTechnicianId(response.data.technicianId || null);
                setSelectedStatus(response.data.appointmentStatus);
            } catch (error) {
                console.error('Error fetching appointment data:', error);
            } finally {
                setLoading(false);
            }
        };
        const fetchTechnicians = async () => {
            try {
                const response = await api.get(`/api/technicians/`);
                setTechnicians(response.data);
            } catch (error) {
                console.error('Error fetching technicians:', error);
            }
        };
        fetchAppointments();
        fetchTechnicians();
    }, [apptId]);

    const handleTechnicianChange = (value) => {
        setSelectedTechnicianId(value === '' ? null : value);
        if (value === '') {
            setUpdatedAppointment((prev) => ({ ...prev, display: { ...prev.display, technicianName: null } }));
        } else {
            const selectedTech = technicians.find(t => t.id === value);
            setUpdatedAppointment((prev) => ({ ...prev, display: { ...prev.display, technicianName: selectedTech?.technicianName } }));
        }
    };

    const handleStatusChange = (value) => {
        if (value === '4') {
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
            if (selectedTechnicianId !== updatedAppointment.technicianId) {
                updateData.technicianId = selectedTechnicianId;
            }
            if (selectedStatus !== updatedAppointment.appointmentStatus) {
                updateData.appointmentStatus = selectedStatus;
                if (selectedStatus === '4') {
                    updateData.cancellationReason = cancellationReason;
                    updateData.cancelledBy = 'coordinator';
                }
            }
            if (Object.keys(updateData).length === 0) {
                message.info('No changes to save');
                return;
            }
            const response = await api.patch(`/api/appointments/${apptId}/`, updateData);
            setUpdatedAppointment(response.data);
            setSelectedTechnicianId(response.data.technicianId || null);
            setSelectedStatus(response.data.appointmentStatus);
            message.success('Appointment updated successfully');
            setTimeout(() => { window.location.href = '/coordinator/home'; }, 1000);
        } catch (error) {
            console.error('Error updating appointment:', error);
            if (error.response?.data?.error) message.error(error.response.data.error);
            else message.error('Failed to update appointment');
        }
    };

    const renderLoading = () => (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', fontFamily: FF }}>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading appointment…</p>
        </div>
    );

    const SectionLabel = ({ children }) => (
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18, paddingBottom: 10, borderBottom: '1px solid #f3f4f6' }}>
            {children}
        </div>
    );

    const statusLabel = statusOptions.find(o => o.value === selectedStatus)?.label || 'Unknown';
    const statusColors = { Pending: { bg: '#fef3c7', fg: '#b45309' }, Confirmed: { bg: '#dbeafe', fg: '#1d4ed8' }, Completed: { bg: '#f3f4f6', fg: '#374151' }, Cancelled: { bg: '#fee2e2', fg: '#b91c1c' } };
    const sc = statusColors[statusLabel] || { bg: '#f3f4f6', fg: '#6b7280' };

    const renderForm = () => (
        <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 24px', fontFamily: FF }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <button
                    onClick={() => navigate('/coordinator/home')}
                    style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 16px', fontSize: 13, color: '#6b7280', cursor: 'pointer', fontFamily: FF }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                    ← Back
                </button>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>Update Appointment</h1>
                    <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, marginTop: 2 }}>ID #{apptId}</p>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <span style={{ background: sc.bg, color: sc.fg, padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600 }}>
                        {statusLabel}
                    </span>
                </div>
            </div>

            {/* Card */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', overflow: 'hidden' }}>

                {/* Read-only details */}
                <div style={{ padding: '28px 32px', borderBottom: '1px solid #f3f4f6' }}>
                    <SectionLabel>Appointment Info</SectionLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <label style={LABEL}>Customer</label>
                            <input style={DISABLED_INPUT} value={updatedAppointment.display?.customerName || ''} disabled />
                        </div>
                        <div>
                            <label style={LABEL}>Date & Time</label>
                            <input style={DISABLED_INPUT} value={updatedAppointment.appointmentStartTime ? formatUnixTimestamp(updatedAppointment.appointmentStartTime) : ''} disabled />
                        </div>
                    </div>
                    {updatedAppointment.display?.paymentMethod && (
                        <div style={{ marginTop: 16 }}>
                            <label style={LABEL}>Payment Method</label>
                            <input style={DISABLED_INPUT} value={updatedAppointment.display.paymentMethod} disabled />
                        </div>
                    )}
                </div>

                {/* Aircons (read-only) */}
                {updatedAppointment.display?.airconToService?.length > 0 && (
                    <div style={{ padding: '28px 32px', borderBottom: '1px solid #f3f4f6' }}>
                        <SectionLabel>Aircons to Service</SectionLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {updatedAppointment.display.airconToService.map((airconName, index) => (
                                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f9fafb', borderRadius: 8, border: '1px solid #f3f4f6' }}>
                                    <input type="checkbox" checked disabled style={{ flexShrink: 0 }} />
                                    <span style={{ fontSize: 14, color: '#374151' }}>
                                        {airconName}
                                        {updatedAppointment.display.airconBrand?.[index] && ` [${updatedAppointment.display.airconBrand[index]} | ${updatedAppointment.display.airconModel?.[index] || 'N/A'}]`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Editable fields */}
                <div style={{ padding: '28px 32px', borderBottom: '1px solid #f3f4f6' }}>
                    <SectionLabel>Editable Fields</SectionLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <label style={LABEL}>Assign Technician</label>
                            <select
                                style={SELECT_STYLE}
                                value={selectedTechnicianId ?? ''}
                                onChange={e => handleTechnicianChange(e.target.value)}
                            >
                                <option value="">— Unassigned —</option>
                                {technicians.map(tech => (
                                    <option key={tech.id} value={tech.id}>
                                        {tech.technicianName} {tech.technicianStatus === '1' ? '✓' : '✗'}
                                    </option>
                                ))}
                            </select>
                            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>✓ = Available, ✗ = Unavailable</p>
                        </div>
                        <div>
                            <label style={LABEL}>Appointment Status</label>
                            <select
                                style={SELECT_STYLE}
                                value={selectedStatus}
                                onChange={e => handleStatusChange(e.target.value)}
                            >
                                {statusOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Feedback (read-only) */}
                <div style={{ padding: '28px 32px', borderBottom: updatedAppointment.cancellationReason ? '1px solid #f3f4f6' : 'none' }}>
                    <SectionLabel>Customer Feedback</SectionLabel>
                    <div style={{ padding: '12px 14px', background: '#f9fafb', borderRadius: 8, border: '1px solid #f3f4f6', fontSize: 14, color: updatedAppointment.customerFeedback ? '#374151' : '#9ca3af', fontStyle: updatedAppointment.customerFeedback ? 'normal' : 'italic', lineHeight: 1.6 }}>
                        {updatedAppointment.customerFeedback || 'No feedback provided'}
                    </div>
                </div>

                {/* Existing cancellation reason */}
                {updatedAppointment.cancellationReason && (
                    <div style={{ padding: '28px 32px' }}>
                        <SectionLabel>Cancellation Reason</SectionLabel>
                        <div style={{ padding: '12px 14px', background: '#fff5f5', borderRadius: 8, border: '1px solid #fecaca', fontSize: 14, color: '#b91c1c', lineHeight: 1.6 }}>
                            {updatedAppointment.cancellationReason}
                        </div>
                    </div>
                )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button
                    onClick={handleUpdate}
                    style={{ background: '#4F81BD', color: 'white', border: 'none', borderRadius: 10, padding: '11px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FF }}
                    onMouseEnter={e => e.currentTarget.style.background = '#3b6fa8'}
                    onMouseLeave={e => e.currentTarget.style.background = '#4F81BD'}
                >
                    Save Changes
                </button>
                <button
                    onClick={() => navigate('/coordinator/home')}
                    style={{ background: 'white', color: '#374151', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: FF }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                    Cancel
                </button>
            </div>
        </div>
    );

    return (
        <div style={{ background: '#fafafa', minHeight: '100vh' }}>
            {loading ? renderLoading() : renderForm()}

            {/* Cancellation Modal */}
            <Modal
                title="Cancel Appointment"
                open={showCancelModal}
                onOk={handleCancelModalOk}
                onCancel={handleCancelModalCancel}
                okText="Confirm Cancellation"
                okButtonProps={{ danger: true }}
            >
                <div style={{ marginBottom: 16, paddingTop: 8 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
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
