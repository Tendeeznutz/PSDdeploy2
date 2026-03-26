import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axiosConfig';
import { Progress } from 'antd';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import dayjs from 'dayjs';
import gsap from 'gsap';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const BRAND_OPTIONS = [
    { value: 'daikin', label: 'Daikin' },
    { value: 'mitsubishi', label: 'Mitsubishi' },
    { value: 'panasonic', label: 'Panasonic' },
    { value: 'lg', label: 'LG' },
    { value: 'samsung', label: 'Samsung' },
    { value: 'fujitsu', label: 'Fujitsu' },
    { value: 'sharp', label: 'Sharp' },
    { value: 'toshiba', label: 'Toshiba' },
    { value: 'hitachi', label: 'Hitachi' },
    { value: 'york', label: 'York' },
    { value: 'other', label: 'Other' },
];

/* ─── Drawer wrapper ─────────────────────────────────────────────────────── */
function Drawer({ open, onClose, className, children }) {
    const panelRef = useRef(null);

    useEffect(() => {
        if (open && panelRef.current) {
            gsap.fromTo(panelRef.current, { x: '100%' }, { x: 0, duration: 0.35, ease: 'power3.out' });
        }
    }, [open]);

    if (!open) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
            <div
                ref={panelRef}
                className={className}
                style={{
                    position: 'absolute', top: 0, right: 0, height: '100%',
                    width: 420, maxWidth: '100%',
                    background: 'white', zIndex: 101, padding: 32,
                    overflowY: 'auto',
                    boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
                    boxSizing: 'border-box',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                }}
            >
                {children}
            </div>
        </div>
    );
}

/* ─── Shared input styles ────────────────────────────────────────────────── */
const inputStyle = {
    width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb',
    borderRadius: 8, fontSize: 14, color: '#0f172a', background: 'white',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const labelStyle = {
    fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 6, display: 'block',
};
const fieldWrap = { marginBottom: 20 };
const drawerHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 };
const drawerTitle = { fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 };
const drawerClose = { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 };
const btnRow = { display: 'flex', gap: 12, marginTop: 28 };
const btnPrimary = { flex: 1, background: '#4F81BD', color: 'white', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost = { flex: 1, background: 'white', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' };

function Profile() {
    const navigate = useNavigate();
    const customer_id = localStorage.getItem('customers_id');

    /* ── All existing state (preserved exactly) ─────────────────────────── */
    const [error, setError] = useState('');
    const [modalError, setModalError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditAirconModalOpen, setIsEditAirconModalOpen] = useState(false);
    const [editingAircon, setEditingAircon] = useState(null);
    const [editAirconError, setEditAirconError] = useState('');
    const [progress, setProgress] = useState(0);
    const [showProgress, setShowProgress] = useState(false);
    const [userObject, setUserObject] = useState({
        customerName: '', customerEmail: '', customerPhone: '',
        customerAddress: '', customerPostalCode: ''
    });
    const [isEditing, setIsEditing] = useState(false);
    const [editedDetails, setEditedDetails] = useState({
        customerName: '', customerEmail: '', customerPhone: '',
        customerAddress: '', customerPostalCode: '',
        customerPassword: '', customerPasswordConfirm: ''
    });
    const [editErrorMessage, setEditErrorMessage] = useState('');
    const [userAirconList, setUserAirconList] = useState([]);
    const [airconName, setAirconName] = useState('');
    const [numberOfUnits, setNumberOfUnits] = useState(1);
    const [airconType, setAirconType] = useState('daikin');
    const [lastServiceMonth, setLastServiceMonth] = useState(null);
    const [remarks, setRemarks] = useState('');

    /* ── All existing functions (preserved exactly) ─────────────────────── */
    const fetchUserData = async () => {
        try {
            if (!customer_id) { console.error('No customer ID found'); return; }
            const r = await api.get(`/api/customers/${customer_id}/`);
            return r.data;
        } catch (err) { console.error('Error fetching user data:', err); }
    };

    const fetchUserAirconData = async () => {
        try {
            const r = await api.get(`/api/customeraircondevices/?customerId=${customer_id}`);
            return r.data;
        } catch (err) { console.error('Error fetching aircon data:', err); }
    };

    const toggleModal = () => {
        setIsModalOpen(!isModalOpen);
        if (isModalOpen) {
            setAirconName(''); setNumberOfUnits(1); setAirconType('daikin');
            setLastServiceMonth(null); setRemarks(''); setModalError('');
        }
    };

    const handleDeleteAircon = (airconId) => async () => {
        setError('');
        try {
            const existingResp = await api.get(`/api/appointments/?customerId=${customer_id}`);
            if (existingResp.status === 200) {
                const hasActive = existingResp.data.some(a =>
                    a.airconToService.includes(airconId) && a.appointmentStatus !== '4'
                );
                if (hasActive) throw new Error('Cannot remove aircon with active appointments. Cancel or complete the appointments first.');
                const resp = await api.delete(`/api/customeraircondevices/${airconId}/`);
                if (resp.status === 204) setUserAirconList(userAirconList.filter(a => a.id !== airconId));
            }
        } catch (err) {
            console.error('Error deleting aircon:', err);
            setError(err.message);
        }
    };

    const handleEditAircon = (aircon) => {
        setEditingAircon({
            id: aircon.id,
            airconName: aircon.airconName || '',
            numberOfUnits: aircon.numberOfUnits || 1,
            airconType: aircon.airconType || 'daikin',
            lastServiceMonth: aircon.lastServiceMonth ? dayjs(aircon.lastServiceMonth, 'YYYY-MM') : null,
            remarks: aircon.remarks || ''
        });
        setEditAirconError('');
        setIsEditAirconModalOpen(true);
    };

    const closeEditAirconModal = () => {
        setIsEditAirconModalOpen(false);
        setEditingAircon(null);
        setEditAirconError('');
    };

    const handleEditAirconSubmit = async (event) => {
        event.preventDefault();
        setEditAirconError('');
        try {
            if (!editingAircon.airconType) throw new Error('Please select aircon type.');
            if (editingAircon.numberOfUnits < 1 || editingAircon.numberOfUnits > 100) throw new Error('Number of units must be between 1 and 100.');
            const payload = {
                airconName: editingAircon.airconName || null,
                numberOfUnits: editingAircon.numberOfUnits,
                airconType: editingAircon.airconType,
                lastServiceMonth: editingAircon.lastServiceMonth ? editingAircon.lastServiceMonth.format('YYYY-MM') : null,
                remarks: editingAircon.remarks || null
            };
            const resp = await api.patch(`/api/customeraircondevices/${editingAircon.id}/`, payload);
            if (resp.status === 200) {
                setUserAirconList(userAirconList.map(a => a.id === editingAircon.id ? resp.data : a));
                closeEditAirconModal();
            }
        } catch (err) {
            console.error('Error editing aircon:', err);
            if (err.message.includes('Number of units') || err.message.includes('aircon type')) {
                setEditAirconError(err.message);
            } else if (err.response?.data?.airconName) {
                const msg = Array.isArray(err.response.data.airconName) ? err.response.data.airconName[0] : err.response.data.airconName;
                setEditAirconError(msg || 'This aircon name is already in use.');
            } else if (err.response?.status === 500) {
                setEditAirconError('An error occurred at the server. Please try again.');
            } else {
                setEditAirconError(err.response?.data?.detail || 'An error occurred. Please try again.');
            }
        }
    };

    const handleSubmit = async (event) => {
        setModalError(''); setShowProgress(true); event.preventDefault();
        try {
            if (!airconType) { setShowProgress(false); throw new Error('Please select aircon type.'); }
            if (numberOfUnits < 1 || numberOfUnits > 100) { setShowProgress(false); throw new Error('Number of units must be between 1 and 100.'); }
            const payload = {
                airconName: airconName || null, customerId: customer_id,
                numberOfUnits, airconType,
                lastServiceMonth: lastServiceMonth ? lastServiceMonth.format('YYYY-MM') : null,
                remarks: remarks || null
            };
            const resp = await api.post('/api/customeraircondevices/', payload);
            if (resp.status === 201) {
                setProgress(100);
                setUserAirconList(prev => [...prev, resp.data]);
                setShowProgress(false);
                setProgress(0);
                setIsModalOpen(false);
                setAirconName('');
                setNumberOfUnits(1);
                setAirconType('daikin');
                setLastServiceMonth(null);
                setRemarks('');
            }
        } catch (err) {
            console.error('Error adding aircon:', err);
            if (err.message.includes('Number of units') || err.message.includes('aircon type')) {
                setModalError(err.message);
            } else if (err.response?.data?.airconName) {
                const msg = Array.isArray(err.response.data.airconName) ? err.response.data.airconName[0] : err.response.data.airconName;
                setModalError(msg || 'This aircon name is already in use.');
            } else if (err.response?.data?.lastServiceMonth) {
                setModalError(err.response.data.lastServiceMonth[0] || 'Invalid service month format.');
            } else if (err.response?.data?.numberOfUnits) {
                setModalError(err.response.data.numberOfUnits[0] || 'Invalid number of units.');
            } else if (err.response?.status === 500) {
                setModalError('An error have occured at the server. Please try again.');
            } else {
                setModalError(err.response?.data?.detail || 'An error occurred. Please try again.');
            }
            setShowProgress(false);
        }
    };

    const handleEditToggle = () => {
        if (!isEditing) {
            setEditedDetails({
                customerName: userObject.customerName,
                customerEmail: userObject.customerEmail,
                customerPhone: userObject.customerPhone.replace('+65 ', ''),
                customerAddress: userObject.customerAddress,
                customerPostalCode: userObject.customerPostalCode.replace('S', ''),
                customerPassword: '', customerPasswordConfirm: ''
            });
        }
        setIsEditing(!isEditing);
        setEditErrorMessage('');
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setEditErrorMessage('');
        try {
            const phoneRegex = /^(6|8|9)\d{7}$/;
            if (!phoneRegex.test(editedDetails.customerPhone)) throw new Error('Please enter a valid Singapore phone number.');
            if (editedDetails.customerPassword || editedDetails.customerPasswordConfirm) {
                if (editedDetails.customerPassword !== editedDetails.customerPasswordConfirm) throw new Error('Passwords do not match.');
                if (editedDetails.customerPassword.length < 6) throw new Error('Password must be at least 6 characters long.');
            }
            const payload = {
                customerName: editedDetails.customerName,
                customerEmail: editedDetails.customerEmail,
                customerPhone: editedDetails.customerPhone,
                customerAddress: editedDetails.customerAddress,
                customerPostalCode: editedDetails.customerPostalCode,
            };
            if (editedDetails.customerPassword) payload.customerPassword = editedDetails.customerPassword;
            const resp = await api.patch(`/api/customers/${customer_id}/`, payload);
            if (resp.status === 200) {
                localStorage.setItem('customers_name', resp.data.customerName);
                setUserObject({
                    customerName: resp.data.customerName,
                    customerEmail: resp.data.customerEmail,
                    customerPhone: '+65 ' + resp.data.customerPhone,
                    customerAddress: resp.data.customerAddress,
                    customerPostalCode: 'S' + resp.data.customerPostalCode
                });
                setIsEditing(false);
                setEditedDetails({ ...editedDetails, customerPassword: '', customerPasswordConfirm: '' });
            }
        } catch (err) {
            console.error('Error updating profile:', err);
            if (err.response?.data) {
                const errors = err.response.data;
                const errorMessages = Object.entries(errors)
                    .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
                    .join('; ');
                setEditErrorMessage(errorMessages || 'Failed to update profile. Please try again.');
            } else {
                setEditErrorMessage(err.message || 'Failed to update profile. Please try again.');
            }
        }
    };

    useEffect(() => {
        if (!customer_id) {
            navigate('/error');
        } else {
            fetchUserData().then(data => {
                setUserObject({
                    customerName: data.customerName,
                    customerEmail: data.customerEmail,
                    customerPhone: '+65 ' + data.customerPhone,
                    customerAddress: data.customerAddress,
                    customerPostalCode: 'S' + data.customerPostalCode
                });
                setEditedDetails({
                    customerName: data.customerName,
                    customerEmail: data.customerEmail,
                    customerPhone: data.customerPhone,
                    customerAddress: data.customerAddress,
                    customerPostalCode: data.customerPostalCode,
                    customerPassword: '', customerPasswordConfirm: ''
                });
            });
            fetchUserAirconData().then(d => setUserAirconList(d));
        }
    }, []);

    /* ── GSAP mount animation ────────────────────────────────────────────── */
    useEffect(() => {
        const timer = setTimeout(() => {
            const left = document.querySelectorAll('.profile-left');
            const right = document.querySelectorAll('.profile-right');
            if (left.length > 0) {
                gsap.from(left, { x: -20, opacity: 0, duration: 0.4, ease: 'power2.out' });
            }
            if (right.length > 0) {
                gsap.from(right, { x: 20, opacity: 0, duration: 0.4, ease: 'power2.out' });
            }
        }, 50);
        return () => clearTimeout(timer);
    }, []);

    /* ── Shared page styles ──────────────────────────────────────────────── */
    const S = {
        page: { background: '#fafafa', minHeight: '100vh', padding: 40, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", boxSizing: 'border-box' },
        pageTitle: { fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 28 },
        grid: { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24 },
        card: { background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
        avatar: { width: 80, height: 80, borderRadius: '50%', background: '#EEF4FB', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, fontSize: 24, fontWeight: 700, color: '#4F81BD' },
        name: { fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
        emailRow: { fontSize: 13, color: '#6b7280' },
        divider: { margin: '20px 0', borderTop: '1px solid #f3f4f6', border: 'none', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: '#f3f4f6', height: 1 },
        infoRow: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
        infoIcon: { fontSize: 15, color: '#9ca3af', marginTop: 2, minWidth: 16 },
        infoLabel: { fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 },
        infoValue: { fontSize: 14, color: '#374151' },
        editBtn: { width: '100%', background: '#4F81BD', color: 'white', border: 'none', borderRadius: 10, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 24, fontFamily: 'inherit' },
        cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        cardTitle: { fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 },
        countBadge: { background: '#EEF4FB', color: '#4F81BD', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 9999 },
        unitRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #f9fafb' },
        unitLeft: { display: 'flex', alignItems: 'center', gap: 10 },
        unitIcon: { fontSize: 16, color: '#4F81BD' },
        unitName: { fontSize: 14, fontWeight: 600, color: '#0f172a' },
        unitSpec: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
        removeBtn: { background: 'none', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
        addAirconBtn: { width: '100%', background: 'white', color: '#4F81BD', border: '1.5px solid #4F81BD', borderRadius: 10, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' },
    };

    return (
        <div style={S.page}>
            <p style={S.pageTitle}>My Profile</p>

            <div style={S.grid}>
                {/* ── LEFT: Profile info ──────────────────────────────────── */}
                <div className="profile-left" style={S.card}>
                    <div style={S.avatar}>{getInitials(userObject.customerName)}</div>
                    <div style={S.name}>{userObject.customerName || '—'}</div>
                    <div style={S.emailRow}>{userObject.customerEmail}</div>

                    <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #f3f4f6' }} />

                    <div style={S.infoRow}>
                        <span style={S.infoIcon}>✉</span>
                        <div>
                            <span style={S.infoLabel}>Email</span>
                            <span style={S.infoValue}>{userObject.customerEmail || '—'}</span>
                        </div>
                    </div>
                    <div style={S.infoRow}>
                        <span style={S.infoIcon}>📞</span>
                        <div>
                            <span style={S.infoLabel}>Phone</span>
                            <span style={S.infoValue}>{userObject.customerPhone || '—'}</span>
                        </div>
                    </div>
                    <div style={S.infoRow}>
                        <span style={S.infoIcon}>📍</span>
                        <div>
                            <span style={S.infoLabel}>Address</span>
                            <span style={S.infoValue}>{userObject.customerAddress} {userObject.customerPostalCode}</span>
                        </div>
                    </div>

                    {error && <p style={{ fontSize: 13, color: '#ef4444', marginTop: 8 }}>{error}</p>}

                    <button style={S.editBtn} onClick={handleEditToggle}
                        onMouseEnter={e => e.currentTarget.style.background = '#3a6a9e'}
                        onMouseLeave={e => e.currentTarget.style.background = '#4F81BD'}>
                        Edit Profile
                    </button>
                </div>

                {/* ── RIGHT: Aircon units ─────────────────────────────────── */}
                <div className="profile-right" style={S.card}>
                    <div style={S.cardHeader}>
                        <h2 style={S.cardTitle}>My Aircon Units</h2>
                        <span style={S.countBadge}>{userAirconList.length} unit{userAirconList.length !== 1 ? 's' : ''}</span>
                    </div>

                    {userAirconList.length === 0 ? (
                        <p style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>
                            No aircon units added yet.
                        </p>
                    ) : (
                        userAirconList.map(aircon => (
                            <div key={aircon.id} style={S.unitRow}>
                                <div style={S.unitLeft}>
                                    <span style={S.unitIcon}>💨</span>
                                    <div>
                                        <div style={S.unitName}>{aircon.airconName || 'Unnamed unit'}</div>
                                        <div style={S.unitSpec}>{aircon.numberOfUnits} unit{aircon.numberOfUnits > 1 ? 's' : ''} · {aircon.airconType}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                        style={{ background: '#EEF4FB', color: '#4F81BD', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                                        onClick={() => handleEditAircon(aircon)}>
                                        Edit
                                    </button>
                                    <button style={S.removeBtn}
                                        onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                        onClick={handleDeleteAircon(aircon.id)}>
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ))
                    )}

                    <button style={S.addAirconBtn} onClick={toggleModal}>
                        <span>＋</span> Add Aircon Unit
                    </button>
                </div>
            </div>

            {/* ── DRAWER: Add Aircon ──────────────────────────────────────── */}
            <Drawer open={isModalOpen} onClose={toggleModal} className="add-aircon-drawer">
                <div style={drawerHeader}>
                    <h2 style={drawerTitle}>Add Aircon Unit</h2>
                    <button style={drawerClose} onClick={toggleModal}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div style={fieldWrap}>
                        <label style={labelStyle}>Aircon Name (optional)</label>
                        <input style={inputStyle} type="text" value={airconName}
                            onChange={e => setAirconName(e.target.value)}
                            placeholder="e.g., Living Room AC" />
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>Leave blank for auto-generated name</span>
                    </div>
                    <div style={fieldWrap}>
                        <label style={labelStyle}>Number of Units <span style={{ color: '#ef4444' }}>*</span></label>
                        <input style={inputStyle} type="number" value={numberOfUnits}
                            onChange={e => setNumberOfUnits(parseInt(e.target.value) || 1)}
                            min="1" max="100" required />
                    </div>
                    <div style={fieldWrap}>
                        <label style={labelStyle}>Aircon Brand <span style={{ color: '#ef4444' }}>*</span></label>
                        <select style={{ ...inputStyle, appearance: 'auto' }} value={airconType}
                            onChange={e => setAirconType(e.target.value)} required>
                            {BRAND_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                        </select>
                    </div>
                    <div style={fieldWrap}>
                        <label style={labelStyle}>Last Service Month (optional)</label>
                        <DatePicker
                            selected={lastServiceMonth ? lastServiceMonth.toDate() : null}
                            onChange={date => setLastServiceMonth(date ? dayjs(date) : null)}
                            dateFormat="MMMM yyyy"
                            showMonthYearPicker
                            maxDate={new Date()}
                            placeholderText="Select service month"
                            className="owned-input"
                            wrapperClassName="w-full"
                            customInput={<input style={{ ...inputStyle, display: 'block' }} />}
                        />
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>Click to select month and year from calendar</span>
                    </div>
                    <div style={fieldWrap}>
                        <label style={labelStyle}>Remarks (optional)</label>
                        <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} value={remarks}
                            onChange={e => setRemarks(e.target.value)}
                            placeholder="Any additional information about this aircon..."
                            rows={3} maxLength={500} />
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{remarks.length}/500 characters</span>
                    </div>
                    {modalError && <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{modalError}</p>}
                    {showProgress && <Progress percent={progress} type="line" strokeColor="#4F81BD" style={{ marginBottom: 12 }} />}
                    <div style={btnRow}>
                        <button type="submit" style={btnPrimary}>Add Unit</button>
                        <button type="button" style={btnGhost} onClick={toggleModal}>Cancel</button>
                    </div>
                </form>
            </Drawer>

            {/* ── DRAWER: Edit Aircon ─────────────────────────────────────── */}
            <Drawer open={isEditAirconModalOpen && !!editingAircon} onClose={closeEditAirconModal} className="edit-aircon-drawer">
                {editingAircon && (
                    <>
                        <div style={drawerHeader}>
                            <h2 style={drawerTitle}>Edit Aircon Unit</h2>
                            <button style={drawerClose} onClick={closeEditAirconModal}>×</button>
                        </div>
                        <form onSubmit={handleEditAirconSubmit}>
                            <div style={fieldWrap}>
                                <label style={labelStyle}>Aircon Name (optional)</label>
                                <input style={inputStyle} type="text" value={editingAircon.airconName}
                                    onChange={e => setEditingAircon({ ...editingAircon, airconName: e.target.value })}
                                    placeholder="e.g., Living Room AC" />
                            </div>
                            <div style={fieldWrap}>
                                <label style={labelStyle}>Number of Units <span style={{ color: '#ef4444' }}>*</span></label>
                                <input style={inputStyle} type="number" value={editingAircon.numberOfUnits}
                                    onChange={e => setEditingAircon({ ...editingAircon, numberOfUnits: parseInt(e.target.value) || 1 })}
                                    min="1" max="100" required />
                            </div>
                            <div style={fieldWrap}>
                                <label style={labelStyle}>Aircon Brand <span style={{ color: '#ef4444' }}>*</span></label>
                                <select style={{ ...inputStyle, appearance: 'auto' }} value={editingAircon.airconType}
                                    onChange={e => setEditingAircon({ ...editingAircon, airconType: e.target.value })} required>
                                    {BRAND_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                                </select>
                            </div>
                            <div style={fieldWrap}>
                                <label style={labelStyle}>Last Service Month (optional)</label>
                                <DatePicker
                                    selected={editingAircon.lastServiceMonth ? editingAircon.lastServiceMonth.toDate() : null}
                                    onChange={date => setEditingAircon({ ...editingAircon, lastServiceMonth: date ? dayjs(date) : null })}
                                    dateFormat="MMMM yyyy"
                                    showMonthYearPicker
                                    maxDate={new Date()}
                                    placeholderText="Select service month"
                                    customInput={<input style={{ ...inputStyle, display: 'block' }} />}
                                />
                            </div>
                            <div style={fieldWrap}>
                                <label style={labelStyle}>Remarks (optional)</label>
                                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} value={editingAircon.remarks}
                                    onChange={e => setEditingAircon({ ...editingAircon, remarks: e.target.value })}
                                    rows={3} maxLength={500} />
                                <span style={{ fontSize: 11, color: '#9ca3af' }}>{(editingAircon.remarks || '').length}/500 characters</span>
                            </div>
                            {editAirconError && <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{editAirconError}</p>}
                            <div style={btnRow}>
                                <button type="submit" style={btnPrimary}>Save Changes</button>
                                <button type="button" style={btnGhost} onClick={closeEditAirconModal}>Cancel</button>
                            </div>
                        </form>
                    </>
                )}
            </Drawer>

            {/* ── DRAWER: Edit Profile ────────────────────────────────────── */}
            <Drawer open={isEditing} onClose={handleEditToggle} className="edit-profile-drawer">
                <div style={drawerHeader}>
                    <h2 style={drawerTitle}>Edit Profile</h2>
                    <button style={drawerClose} onClick={handleEditToggle}>×</button>
                </div>
                <form onSubmit={handleSaveProfile}>
                    {[
                        { label: 'Full Name', key: 'customerName', type: 'text' },
                        { label: 'Email', key: 'customerEmail', type: 'email' },
                        { label: 'Phone', key: 'customerPhone', type: 'text', hint: 'Singapore number: 8-digit starting with 6, 8, or 9' },
                        { label: 'Address', key: 'customerAddress', type: 'text' },
                        { label: 'Postal Code', key: 'customerPostalCode', type: 'text' },
                    ].map(({ label, key, type, hint }) => (
                        <div key={key} style={fieldWrap}>
                            <label style={labelStyle}>{label}</label>
                            <input style={inputStyle} type={type} value={editedDetails[key]}
                                onChange={e => setEditedDetails({ ...editedDetails, [key]: e.target.value })}
                                required={key !== 'customerPostalCode'} />
                            {hint && <span style={{ fontSize: 11, color: '#9ca3af' }}>{hint}</span>}
                        </div>
                    ))}
                    <div style={fieldWrap}>
                        <label style={labelStyle}>New Password (leave blank to keep current)</label>
                        <input style={inputStyle} type="password" value={editedDetails.customerPassword}
                            onChange={e => setEditedDetails({ ...editedDetails, customerPassword: e.target.value })}
                            placeholder="Enter new password" />
                    </div>
                    <div style={fieldWrap}>
                        <label style={labelStyle}>Confirm New Password</label>
                        <input style={inputStyle} type="password" value={editedDetails.customerPasswordConfirm}
                            onChange={e => setEditedDetails({ ...editedDetails, customerPasswordConfirm: e.target.value })}
                            placeholder="Confirm new password" />
                    </div>
                    {editErrorMessage && <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{editErrorMessage}</p>}
                    <div style={btnRow}>
                        <button type="submit" style={btnPrimary}>Save Changes</button>
                        <button type="button" style={btnGhost} onClick={handleEditToggle}>Cancel</button>
                    </div>
                </form>
            </Drawer>
        </div>
    );
}

export default Profile;
