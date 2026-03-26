import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axiosConfig';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Progress, Popconfirm, Modal, Input } from 'antd';
import gsap from 'gsap';
import { StatusBadge } from '../components/StatusBadge';

const { TextArea } = Input;

function AppointmentDetails() {
    const techniciansPhone = localStorage.getItem('technicians_phone');
    const hasTechniciansPhone = techniciansPhone !== null;

    /* ── All existing state (preserved exactly) ─────────────────────────── */
    const [dateTime, setDateTime] = useState('');
    const [selectedAircons, setSelectedAircons] = useState([]);
    const [airconData, setAirconData] = useState([]);
    const [feedback, setFeedback] = useState('');
    const [customerData, setCustomerData] = useState({});
    const [apptStatus, setApptStatus] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [cancellationReason, setCancellationReason] = useState('');
    const [existingCancellationReason, setExistingCancellationReason] = useState('');
    const [error, setError] = useState('');
    const [editState, setEditState] = useState(false);
    const [progress, setProgress] = useState(0);
    const [showProgress, setShowProgress] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const navigate = useNavigate();

    const apptId = new URLSearchParams(window.location.search).get('id');

    /* ── All existing functions (preserved exactly) ─────────────────────── */
    const fetchSelectedAppointmentData = async () => {
        try {
            const appointmentDataResponse = await api.get(`/api/appointments/` + apptId + `/`);
            return appointmentDataResponse.data;
        } catch (error) {
            console.error('Error fetching appointment data:', error);
        }
    };

    const fetchSelectedUserAircon = async (customerId) => {
        try {
            const userSelectedAirconResponse = await api.get(`/api/customeraircondevices/?customerId=${customerId}`);
            return userSelectedAirconResponse.data;
        } catch (error) {
            console.error('Error fetching user selected aircon:', error);
        }
    };

    /* ── Extra customer detail fetch for the new layout ─────────────────── */
    const [fullCustomerData, setFullCustomerData] = useState(null);

    useEffect(() => {
        fetchSelectedAppointmentData().then((appointmentData) => {
            if (!appointmentData) return;
            setDateTime(new Date(appointmentData.appointmentStartTime * 1000));
            setSelectedAircons(appointmentData.airconToService);
            setFeedback(appointmentData.customerFeedback);
            setCustomerData({
                customerId: appointmentData.customerId,
                customerName: appointmentData.display.customerName,
            });
            setApptStatus(appointmentData.display.appointmentStatus);
            setPaymentMethod(appointmentData.display.paymentMethod || '');
            if (appointmentData.cancellationReason) {
                setExistingCancellationReason(appointmentData.cancellationReason);
            }

            api.get(`/api/customers/${appointmentData.customerId}/`)
                .then(r => setFullCustomerData(r.data))
                .catch(() => {});

            fetchSelectedUserAircon(appointmentData.customerId).then((userSelectedAirconList) => {
                setAirconData(userSelectedAirconList);
            });
        });
    }, [editState]);

    /* ── GSAP card entrance ──────────────────────────────────────────────── */
    useEffect(() => {
        const timer = setTimeout(() => {
            const cards = document.querySelectorAll('.appt-detail-card');
            if (cards.length > 0) {
                gsap.from(cards, { opacity: 0, y: 28, duration: 0.4, ease: 'power2.out' });
            }
        }, 50);
        return () => clearTimeout(timer);
    }, []);

    const handleAirconChange = (airconId) => {
        console.log('Aircon changed:', airconId);
        setSelectedAircons(prevSelectedAircons => {
            if (prevSelectedAircons.includes(airconId)) {
                return prevSelectedAircons.filter(id => id !== airconId);
            } else {
                return [...prevSelectedAircons, airconId];
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setShowProgress(true);
        try {
            if (!dateTime || selectedAircons.length === 0) throw new Error('Please fill in all fields.');
            const singaporeDateTimeUnix = dateTime.getTime() / 1000;
            const response = await api.patch(`/api/appointments/` + apptId + '/', {
                appointmentStartTime: singaporeDateTimeUnix,
                airconToService: selectedAircons,
                customerFeedback: feedback || null,
            });
            if (response.status === 200) {
                setProgress(100);
                setTimeout(() => { navigate('/customer/home'); }, 1000);
            }
        } catch (error) {
            console.error('Error scheduling appointment:', error.response);
            if (error.response?.data) {
                const responseData = error.response.data;
                const backendMessage =
                    responseData.error
                    || responseData.appointmentStartTime?.[0]
                    || responseData.airconToService?.[0]
                    || responseData.detail;
                setError(backendMessage || 'Failed to update appointment. Please try again.');
            } else {
                setError(error.message || 'Scheduled Date cannot be past or present. Please try again.');
            }
            setShowProgress(false);
        }
    };

    const handleDelete = async (e) => {
        e.preventDefault();
        setError('');
        setShowProgress(true);
        try {
            const response = await api.delete(`/api/appointments/` + apptId + '/');
            if (response.status === 204) {
                setProgress(100);
                setTimeout(() => { navigate('/customer/home'); }, 1000);
            }
        } catch (error) {
            console.error('Error deleting appointment:', error);
            setError('Error deleting appointment. Please try again.');
            setShowProgress(false);
        }
    };

    const handleCancelClick = () => {
        setShowCancelModal(true);
        setError('');
    };

    const handleCancelModalOk = async () => {
        if (!cancellationReason || cancellationReason.trim() === '') {
            setError('Please provide a reason for cancellation.');
            return;
        }
        setError('');
        setShowProgress(true);
        setShowCancelModal(false);
        try {
            const response = await api.patch(`/api/appointments/` + apptId + '/', {
                appointmentStatus: '4',
                cancellationReason: cancellationReason,
                cancelledBy: 'technician',
            });
            if (response.status === 200) {
                setProgress(100);
                setTimeout(() => { navigate('/technician/home'); }, 1000);
            }
        } catch (error) {
            console.error('Error cancelling appointment:', error);
            if (error.response?.data?.error) {
                setError(error.response.data.error);
            } else {
                setError('Error cancelling appointment. Please try again.');
            }
            setShowProgress(false);
        }
    };

    const handleCancelModalCancel = () => {
        setShowCancelModal(false);
        setCancellationReason('');
        setError('');
    };

    const toggleEditState = () => {
        setEditState(prevEditState => !prevEditState);
    };

    /* ── Styles ──────────────────────────────────────────────────────────── */
    const S = {
        page: { background: '#fafafa', minHeight: '100vh', padding: 40, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", boxSizing: 'border-box' },
        backBtn: { background: 'none', border: 'none', fontSize: 13, color: '#1a5c4a', cursor: 'pointer', fontWeight: 500, padding: 0, marginBottom: 24, display: 'block', fontFamily: 'inherit' },
        card: { background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 40, maxWidth: 720, margin: '0 auto', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' },
        cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid #f3f4f6' },
        cardTitle: { fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 },
        sectionLabel: { fontSize: 10, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14, display: 'block' },
        infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
        infoItem: { marginBottom: 4 },
        infoItemLabel: { fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' },
        infoItemValue: { fontSize: 14, color: '#0f172a', fontWeight: 500 },
        divider: { margin: '24px 0', border: 'none', borderTop: '1px solid #f3f4f6' },
        airconBox: { marginTop: 12, background: '#f9fafb', borderRadius: 10, padding: '14px 18px' },
        airconName: { fontSize: 14, fontWeight: 600, color: '#0f172a', margin: '4px 0 2px' },
        airconSpec: { fontSize: 12, color: '#6b7280' },
        mapBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white', color: '#1a5c4a', border: '1.5px solid #1a5c4a', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
        textarea: { width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, color: '#0f172a', minHeight: 100, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
        btnRow: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 },
        primaryBtn: { background: '#1a5c4a', color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
        secondaryBtn: { background: 'white', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
        dangerBtn: { background: 'white', color: '#ef4444', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
        cancelBox: { background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginTop: 12, fontSize: 13, color: '#b91c1c' },
    };

    const airconServiced = airconData.filter(a => selectedAircons.includes(a.id));

    const formatDateTime = (dt) => {
        if (!dt) return '—';
        return dt.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    };

    return (
        <div style={S.page}>
            <button style={S.backBtn} onClick={() => navigate(-1)}>← Back to Schedule</button>

            <div className="appt-detail-card" style={S.card}>
                {/* ── Card header ──────────────────────────────────────── */}
                <div style={S.cardHeader}>
                    <h2 style={S.cardTitle}>Appointment Details</h2>
                    <StatusBadge status={apptStatus} />
                </div>

                {/* ── Section 1: Appointment info ──────────────────────── */}
                <span style={S.sectionLabel}>Appointment Info</span>
                <div style={S.infoGrid}>
                    <div style={S.infoItem}>
                        <span style={S.infoItemLabel}>Date &amp; Time</span>
                        {editState ? (
                            <DatePicker
                                id="date-time"
                                selected={dateTime}
                                onChange={(date) => setDateTime(date)}
                                showTimeSelect
                                timeFormat="HH:mm"
                                timeIntervals={30}
                                timeCaption="time"
                                dateFormat="MMM d, yyyy h:mm aa"
                                customInput={
                                    <input style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }} />
                                }
                            />
                        ) : (
                            <span style={S.infoItemValue}>{formatDateTime(dateTime)}</span>
                        )}
                    </div>
                    <div style={S.infoItem}>
                        <span style={S.infoItemLabel}>Status</span>
                        <span style={S.infoItemValue}>{apptStatus || '—'}</span>
                    </div>
                    <div style={S.infoItem}>
                        <span style={S.infoItemLabel}>Appointment ID</span>
                        <span style={{ ...S.infoItemValue, fontSize: 12, wordBreak: 'break-all' }}>{apptId}</span>
                    </div>
                    {(!hasTechniciansPhone && paymentMethod) && (
                        <div style={S.infoItem}>
                            <span style={S.infoItemLabel}>Payment Method</span>
                            <span style={S.infoItemValue}>{paymentMethod}</span>
                        </div>
                    )}
                    {hasTechniciansPhone && paymentMethod && (
                        <div style={S.infoItem}>
                            <span style={S.infoItemLabel}>Payment Method</span>
                            <span style={S.infoItemValue}>{paymentMethod}</span>
                        </div>
                    )}
                </div>

                <hr style={S.divider} />

                {/* ── Section 2: Customer info ──────────────────────────── */}
                <span style={S.sectionLabel}>Customer Info</span>
                <div style={S.infoGrid}>
                    <div style={S.infoItem}>
                        <span style={S.infoItemLabel}>Customer Name</span>
                        <span style={S.infoItemValue}>{customerData.customerName || '—'}</span>
                    </div>
                    <div style={S.infoItem}>
                        <span style={S.infoItemLabel}>Phone</span>
                        <span style={S.infoItemValue}>{fullCustomerData?.customerPhone || '—'}</span>
                    </div>
                    <div style={S.infoItem}>
                        <span style={S.infoItemLabel}>Email</span>
                        <span style={S.infoItemValue}>{fullCustomerData?.customerEmail || '—'}</span>
                    </div>
                    <div style={S.infoItem}>
                        <span style={S.infoItemLabel}>Postal Code</span>
                        <span style={S.infoItemValue}>{fullCustomerData ? `S${fullCustomerData.customerPostalCode}` : '—'}</span>
                    </div>
                    <div style={{ ...S.infoItem, gridColumn: '1 / -1' }}>
                        <span style={S.infoItemLabel}>Address</span>
                        <span style={S.infoItemValue}>{fullCustomerData?.customerAddress || '—'}</span>
                    </div>
                </div>

                {/* Aircon units */}
                <div style={S.airconBox}>
                    <span style={{ ...S.sectionLabel, marginBottom: 8 }}>Aircon System</span>
                    {editState ? (
                        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                            {airconData.map((aircon) => (
                                <div key={aircon.id} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
                                    <input
                                        type="checkbox"
                                        id={aircon.id}
                                        value={aircon.id}
                                        checked={selectedAircons.includes(aircon.id)}
                                        onChange={() => handleAirconChange(aircon.id)}
                                    />
                                    <label htmlFor={aircon.id}>{aircon.airconName} ({aircon.numberOfUnits} unit{aircon.numberOfUnits > 1 ? 's' : ''} · {aircon.airconType})</label>
                                </div>
                            ))}
                        </fieldset>
                    ) : (
                        airconServiced.length > 0 ? (
                            airconServiced.map(a => (
                                <div key={a.id}>
                                    <div style={S.airconName}>{a.airconName || 'Unnamed unit'}</div>
                                    <div style={S.airconSpec}>{a.numberOfUnits} unit{a.numberOfUnits > 1 ? 's' : ''} · {a.airconType}</div>
                                </div>
                            ))
                        ) : (
                            <span style={{ fontSize: 13, color: '#9ca3af' }}>No aircon units selected.</span>
                        )
                    )}
                </div>

                <hr style={S.divider} />

                {/* ── Section 3: Location ───────────────────────────────── */}
                <span style={S.sectionLabel}>Location</span>
                <p style={{ fontSize: 14, color: '#374151', marginBottom: 12 }}>
                    {fullCustomerData ? `${fullCustomerData.customerAddress}, Singapore ${fullCustomerData.customerPostalCode}` : '—'}
                </p>
                {fullCustomerData && (
                    <button
                        style={S.mapBtn}
                        onClick={() => {
                            const query = encodeURIComponent(`${fullCustomerData.customerAddress} Singapore ${fullCustomerData.customerPostalCode}`);
                            window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                        }}
                    >
                        📍 View on Map →
                    </button>
                )}

                <hr style={S.divider} />

                {/* ── Section 4: Notes / Feedback ──────────────────────── */}
                <span style={S.sectionLabel}>Notes / Feedback</span>
                <textarea
                    style={S.textarea}
                    placeholder="No feedback"
                    value={feedback || ''}
                    onChange={(e) => setFeedback(e.target.value)}
                    disabled={!editState}
                    onFocus={e => { e.currentTarget.style.borderColor = '#1a5c4a'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,92,74,0.1)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                />

                {/* Cancellation reason */}
                {existingCancellationReason && (
                    <div style={S.cancelBox}>
                        <strong>Cancellation Reason:</strong> {existingCancellationReason}
                    </div>
                )}

                {error && <p style={{ fontSize: 13, color: '#ef4444', marginTop: 12 }}>{error}</p>}

                {/* ── Action buttons ────────────────────────────────────── */}
                <div style={S.btnRow}>
                    {editState ? (
                        <>
                            <button style={S.secondaryBtn} type="button" onClick={toggleEditState}>Cancel</button>
                            {hasTechniciansPhone && apptStatus !== 'Pending' && apptStatus !== 'Completed' && apptStatus !== 'Cancelled' ? (
                                <button style={S.dangerBtn} type="button" onClick={handleCancelClick}>Cancel Appointment</button>
                            ) : (
                                <Popconfirm
                                    title="Update appointment?"
                                    description="This action cannot be undone."
                                    okButtonProps={{ danger: true }}
                                    onConfirm={handleSubmit}
                                >
                                    <button style={S.primaryBtn} type="button">Update Appointment</button>
                                </Popconfirm>
                            )}
                        </>
                    ) : (
                        <>
                            {!hasTechniciansPhone && (
                                <button style={S.primaryBtn} type="button" onClick={toggleEditState}>Edit Appointment</button>
                            )}
                            {hasTechniciansPhone && apptStatus !== 'Pending' && apptStatus !== 'Completed' && apptStatus !== 'Cancelled' && (
                                <button style={S.dangerBtn} type="button" onClick={handleCancelClick}>Cancel Appointment</button>
                            )}
                            {!hasTechniciansPhone && (
                                <Popconfirm
                                    title="Delete appointment?"
                                    description="This action cannot be undone."
                                    okButtonProps={{ danger: true }}
                                    onConfirm={handleDelete}
                                >
                                    <button style={S.dangerBtn} type="button">Delete Appointment</button>
                                </Popconfirm>
                            )}
                        </>
                    )}
                </div>

                {showProgress && <Progress className="mt-3" percent={progress} type="line" style={{ marginTop: 16 }} />}
            </div>

            {/* ── Cancellation modal (untouched logic) ─────────────────── */}
            <Modal
                title="Cancel Appointment"
                open={showCancelModal}
                onOk={handleCancelModalOk}
                onCancel={handleCancelModalCancel}
                okText="Confirm Cancellation"
                okButtonProps={{ danger: true }}
            >
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#374151' }}>
                        Please provide a reason for cancellation:
                    </label>
                    <TextArea
                        rows={4}
                        placeholder="Enter cancellation reason (required)"
                        value={cancellationReason}
                        onChange={(e) => setCancellationReason(e.target.value)}
                        maxLength={500}
                    />
                    {error && <p style={{ marginTop: 8, fontSize: 13, color: '#ef4444' }}>{error}</p>}
                </div>
            </Modal>
        </div>
    );
}

export default AppointmentDetails;
