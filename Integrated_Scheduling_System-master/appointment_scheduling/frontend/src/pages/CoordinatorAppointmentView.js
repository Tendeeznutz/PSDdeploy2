import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axiosConfig';
import { StatusBadge } from '../components/StatusBadge';

const FF = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

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
        const date = new Date(unixTimestamp * 1000);
        return date.toLocaleString();
    }

    const renderLoading = () => (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', fontFamily: FF }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTop: '3px solid #4F81BD', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading appointment…</p>
            </div>
        </div>
    );

    const InfoRow = ({ label, value }) => (
        <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{label}</div>
            <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 400, padding: '9px 14px', background: '#f9fafb', borderRadius: 8, border: '1px solid #f3f4f6' }}>{value || '—'}</div>
        </div>
    );

    const SectionLabel = ({ children }) => (
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #f3f4f6' }}>
            {children}
        </div>
    );

    const renderAppointmentDetails = () => (
        <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 24px', fontFamily: FF }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <button
                    onClick={() => navigate('/coordinator/home')}
                    style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 16px', fontSize: 13, color: '#6b7280', cursor: 'pointer', fontFamily: FF, display: 'flex', alignItems: 'center', gap: 6 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                    ← Back
                </button>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>Appointment Details</h1>
                    <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, marginTop: 2 }}>ID #{apptId}</p>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <StatusBadge status={appointment.display?.appointmentStatus} />
                </div>
            </div>

            {/* Main card */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', overflow: 'hidden' }}>

                {/* People section */}
                <div style={{ padding: '28px 32px', borderBottom: '1px solid #f3f4f6' }}>
                    <SectionLabel>People</SectionLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <InfoRow label="Customer" value={appointment.display?.customerName} />
                        <InfoRow label="Technician" value={appointment.display?.technicianName || 'No technician assigned'} />
                    </div>
                </div>

                {/* Scheduling section */}
                <div style={{ padding: '28px 32px', borderBottom: '1px solid #f3f4f6' }}>
                    <SectionLabel>Scheduling</SectionLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <InfoRow label="Date & Time" value={formatUnixTimestamp(appointment.appointmentStartTime)} />
                        <InfoRow label="Payment Method" value={appointment.display?.paymentMethod} />
                    </div>
                </div>

                {/* Aircons section */}
                <div style={{ padding: '28px 32px', borderBottom: '1px solid #f3f4f6' }}>
                    <SectionLabel>Aircons to Service</SectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {appointment.display?.airconBrand?.map((aircon, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#f9fafb', borderRadius: 10, border: '1px solid #f3f4f6' }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4F81BD', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                                        {appointment.display?.airconToService?.[index] || aircon}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                                        {aircon} {appointment.display?.airconModel?.[index] ? `· ${appointment.display.airconModel[index]}` : ''}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Feedback section */}
                <div style={{ padding: '28px 32px' }}>
                    <SectionLabel>Customer Feedback</SectionLabel>
                    <div style={{ padding: '12px 16px', background: '#f9fafb', borderRadius: 10, border: '1px solid #f3f4f6', fontSize: 14, color: appointment.customerFeedback ? '#374151' : '#9ca3af', fontStyle: appointment.customerFeedback ? 'normal' : 'italic', lineHeight: 1.6 }}>
                        {appointment.customerFeedback || 'No feedback provided'}
                    </div>
                </div>
            </div>

            {/* Action row */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button
                    onClick={() => window.location.href = '/coordinator/appointmentUpdate?id=' + apptId}
                    style={{ background: '#4F81BD', color: 'white', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FF }}
                    onMouseEnter={e => e.currentTarget.style.background = '#3b6fa8'}
                    onMouseLeave={e => e.currentTarget.style.background = '#4F81BD'}
                >
                    ✏️ Edit Appointment
                </button>
                <button
                    onClick={() => navigate('/coordinator/home')}
                    style={{ background: 'white', color: '#374151', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: FF }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                    Back to Dashboard
                </button>
            </div>
        </div>
    );

    return (
        <div style={{ background: '#fafafa', minHeight: '100vh' }}>
            {loading ? renderLoading() : renderAppointmentDetails()}
        </div>
    );
}

export default CoordinatorAppointmentView;
