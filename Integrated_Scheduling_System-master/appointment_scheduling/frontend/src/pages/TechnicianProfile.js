import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axiosConfig';
import gsap from 'gsap';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

/* ─── Drawer ─────────────────────────────────────────────────────────────── */
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
                    width: 440, maxWidth: '100%',
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

/* ─── Shared form styles ─────────────────────────────────────────────────── */
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

const AC_BRANDS = ['Daikin', 'Mitsubishi', 'Panasonic', 'LG', 'Samsung', 'Fujitsu', 'Sharp', 'Toshiba', 'Hitachi', 'York', 'Other'];
const VALID_TRAVEL_TYPES = ['own_vehicle', 'rented_vehicle', 'company_vehicle'];

function TechnicianProfile() {
    const navigate = useNavigate();

    /* ── Existing state (preserved exactly) ─────────────────────────────── */
    const [techniciandetails, setTechniciandetails] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editedDetails, setEditedDetails] = useState({
        technicianName: '',
        technicianPhone: '',
        technicianEmail: '',
        technicianAddress: '',
        technicianPostalCode: '',
        technicianTravelType: '',
        specializations: [],
        technicianPassword: '',
        technicianPasswordConfirm: '',
    });
    const [errorMessage, setErrorMessage] = useState('');

    const displayTravelType = (travelType) => {
        if (!travelType) return 'Not Set';
        const travelTypes = {
            own_vehicle: 'Own Vehicle',
            rented_vehicle: 'Rented Vehicle',
            company_vehicle: 'Company Vehicle',
        };
        return travelTypes[travelType] || travelType;
    };

    useEffect(() => {
        api.get(`/api/technicians/?technicianId=` + localStorage.getItem('technicians_id'))
            .then(response => {
                const data = response.data[0];
                if (!data) {
                    setErrorMessage('Unable to load technician profile.');
                    return;
                }
                setTechniciandetails(data);
                const loadedTravelType = VALID_TRAVEL_TYPES.includes(data.technicianTravelType) ? data.technicianTravelType : null;
                setEditedDetails({
                    technicianName: data.technicianName,
                    technicianPhone: data.technicianPhone,
                    technicianEmail: data.technicianEmail || '',
                    technicianAddress: data.technicianAddress,
                    technicianPostalCode: data.technicianPostalCode,
                    technicianTravelType: loadedTravelType,
                    specializations: data.specializations || [],
                    technicianPassword: '',
                    technicianPasswordConfirm: '',
                });
            })
            .catch(error => { console.error('There was an error!', error); });
    }, []);

    const handleEditToggle = () => {
        setIsEditing(!isEditing);
        setErrorMessage('');
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        try {
            const phoneRegex = /^(6|8|9)\d{7}$/;
            if (!phoneRegex.test(editedDetails.technicianPhone)) throw new Error('Please enter a valid Singapore phone number.');
            if (editedDetails.technicianEmail) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(editedDetails.technicianEmail)) throw new Error('Please enter a valid email address.');
            }
            if (editedDetails.technicianPassword || editedDetails.technicianPasswordConfirm) {
                if (editedDetails.technicianPassword !== editedDetails.technicianPasswordConfirm) throw new Error('Passwords do not match.');
                if (editedDetails.technicianPassword.length < 6) throw new Error('Password must be at least 6 characters long.');
            }
            const payload = {
                technicianName: editedDetails.technicianName,
                technicianPhone: editedDetails.technicianPhone,
                technicianEmail: editedDetails.technicianEmail || null,
                technicianAddress: editedDetails.technicianAddress,
                technicianPostalCode: editedDetails.technicianPostalCode,
                technicianTravelType: editedDetails.technicianTravelType || null,
                specializations: editedDetails.specializations || [],
            };
            if (editedDetails.technicianPassword) payload.technicianPassword = editedDetails.technicianPassword;
            const response = await api.patch(`/api/technicians/${techniciandetails.id}/`, payload);
            if (response.status === 200) {
                setTechniciandetails(response.data);
                localStorage.setItem('technicians_name', response.data.technicianName);
                setIsEditing(false);
                setEditedDetails({ ...editedDetails, technicianPassword: '', technicianPasswordConfirm: '' });
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            if (error.response?.data) {
                const errors = error.response.data;
                const errorMessages = Object.entries(errors)
                    .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
                    .join('; ');
                setErrorMessage(errorMessages || `Request failed with status code ${error.response.status}`);
            } else if (error.message) {
                setErrorMessage(error.message);
            } else {
                setErrorMessage('Failed to update profile. Please try again.');
            }
        }
    };

    /* ── GSAP mount ──────────────────────────────────────────────────────── */
    useEffect(() => {
        const timer = setTimeout(() => {
            const left = document.querySelectorAll('.tech-profile-left');
            const right = document.querySelectorAll('.tech-profile-right');
            if (left.length > 0) {
                gsap.from(left, { x: -20, opacity: 0, duration: 0.4, ease: 'power2.out' });
            }
            if (right.length > 0) {
                gsap.from(right, { x: 20, opacity: 0, duration: 0.4, ease: 'power2.out' });
            }
        }, 50);
        return () => clearTimeout(timer);
    }, []);

    const S = {
        page: { background: '#fafafa', minHeight: '100vh', padding: 40, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", boxSizing: 'border-box' },
        pageTitle: { fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 28px' },
        grid: { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24 },
        card: { background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
        avatar: { width: 80, height: 80, borderRadius: '50%', background: '#EEF4FB', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, fontSize: 24, fontWeight: 700, color: '#4F81BD' },
        name: { fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
        badgeRow: { display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
        badgeGreen: { background: '#dbeafe', color: '#1d4ed8', padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600 },
        badgeBlue: { background: '#dbeafe', color: '#1d4ed8', padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600 },
        infoRow: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
        infoIcon: { fontSize: 14, color: '#9ca3af', marginTop: 2, minWidth: 16 },
        infoLabel: { fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 },
        infoValue: { fontSize: 14, color: '#374151' },
        editBtn: { width: '100%', background: '#4F81BD', color: 'white', border: 'none', borderRadius: 10, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 24, fontFamily: 'inherit' },
        cardTitle: { fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 20px' },
        tagWrap: { display: 'flex', flexWrap: 'wrap', gap: 8 },
        tag: { background: '#EEF4FB', color: '#4F81BD', border: '1px solid #bfdbfe', padding: '6px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 500 },
        schedSection: { marginTop: 24, paddingTop: 24, borderTop: '1px solid #f3f4f6' },
        schedTitle: { fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 12px' },
        schedBtn: { background: 'white', color: '#4F81BD', border: '1.5px solid #4F81BD', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
    };

    const specs = techniciandetails.specializations || [];

    return (
        <div style={S.page}>
            <p style={S.pageTitle}>My Profile</p>
            <div style={S.grid}>
                {/* ── LEFT ───────────────────────────────────────────────── */}
                <div className="tech-profile-left" style={S.card}>
                    <div style={S.avatar}>{getInitials(techniciandetails.technicianName)}</div>
                    <div style={S.name}>{techniciandetails.technicianName || '—'}</div>
                    <div style={S.badgeRow}>
                        <span style={S.badgeGreen}>
                            {techniciandetails.technicianStatus === '1' ? 'Available' : 'Unavailable'}
                        </span>
                        <span style={S.badgeBlue}>
                            {displayTravelType(techniciandetails.technicianTravelType)}
                        </span>
                    </div>
                    <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #f3f4f6' }} />
                    <div style={S.infoRow}>
                        <span style={S.infoIcon}>✉</span>
                        <div>
                            <span style={S.infoLabel}>Email</span>
                            <span style={S.infoValue}>{techniciandetails.technicianEmail || '(Not set)'}</span>
                        </div>
                    </div>
                    <div style={S.infoRow}>
                        <span style={S.infoIcon}>📞</span>
                        <div>
                            <span style={S.infoLabel}>Phone</span>
                            <span style={S.infoValue}>{techniciandetails.technicianPhone || '—'}</span>
                        </div>
                    </div>
                    <div style={S.infoRow}>
                        <span style={S.infoIcon}>📍</span>
                        <div>
                            <span style={S.infoLabel}>Address</span>
                            <span style={S.infoValue}>{techniciandetails.technicianAddress} {techniciandetails.technicianPostalCode ? `S${techniciandetails.technicianPostalCode}` : ''}</span>
                        </div>
                    </div>
                    <button
                        style={S.editBtn}
                        onClick={handleEditToggle}
                        onMouseEnter={e => e.currentTarget.style.background = '#15503f'}
                        onMouseLeave={e => e.currentTarget.style.background = '#4F81BD'}
                    >
                        Edit Profile
                    </button>
                </div>

                {/* ── RIGHT ──────────────────────────────────────────────── */}
                <div className="tech-profile-right" style={S.card}>
                    <h2 style={S.cardTitle}>Specializations</h2>
                    {specs.length === 0 ? (
                        <p style={{ fontSize: 14, color: '#9ca3af' }}>No specializations set.</p>
                    ) : (
                        <div style={S.tagWrap}>
                            {specs.map(brand => (
                                <span key={brand} style={S.tag}>{brand}</span>
                            ))}
                        </div>
                    )}

                    <div style={S.schedSection}>
                        <p style={S.schedTitle}>Work Schedule</p>
                        <button
                            style={S.schedBtn}
                            onClick={() => navigate('/technician/home')}
                            onMouseEnter={e => { e.currentTarget.style.background = '#EEF4FB'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
                        >
                            Manage Weekly Schedule →
                        </button>
                        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
                            Opens the weekly working days form on the home page.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── DRAWER: Edit Profile ──────────────────────────────────── */}
            <Drawer open={isEditing} onClose={handleEditToggle} className="tech-edit-drawer">
                <div style={drawerHeader}>
                    <h2 style={drawerTitle}>Edit Profile</h2>
                    <button style={drawerClose} onClick={handleEditToggle}>×</button>
                </div>
                <form onSubmit={handleSaveProfile}>
                    {[
                        { label: 'Full Name', key: 'technicianName', type: 'text' },
                        { label: 'Phone', key: 'technicianPhone', type: 'text', hint: 'Singapore number: 8-digit starting with 6, 8, or 9' },
                        { label: 'Email (for notifications)', key: 'technicianEmail', type: 'email' },
                        { label: 'Address', key: 'technicianAddress', type: 'text' },
                        { label: 'Postal Code', key: 'technicianPostalCode', type: 'text' },
                    ].map(({ label, key, type, hint }) => (
                        <div key={key} style={fieldWrap}>
                            <label style={labelStyle}>{label}</label>
                            <input
                                style={inputStyle}
                                type={type}
                                value={editedDetails[key]}
                                onChange={e => setEditedDetails({ ...editedDetails, [key]: e.target.value })}
                            />
                            {hint && <span style={{ fontSize: 11, color: '#9ca3af' }}>{hint}</span>}
                        </div>
                    ))}
                    <div style={fieldWrap}>
                        <label style={labelStyle}>Travel Type</label>
                        <select
                            style={{ ...inputStyle, appearance: 'auto' }}
                            value={editedDetails.technicianTravelType || ''}
                            onChange={e => setEditedDetails({ ...editedDetails, technicianTravelType: e.target.value || null })}
                        >
                            <option value="">-- Select Travel Type --</option>
                            <option value="own_vehicle">Own Vehicle</option>
                            <option value="rented_vehicle">Rented Vehicle</option>
                            <option value="company_vehicle">Company Vehicle</option>
                        </select>
                    </div>
                    <div style={fieldWrap}>
                        <label style={labelStyle}>AC Brand Specializations</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                            {AC_BRANDS.map(brand => (
                                <label key={brand} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={(editedDetails.specializations || []).includes(brand)}
                                        onChange={e => {
                                            const current = editedDetails.specializations || [];
                                            const updated = e.target.checked ? [...current, brand] : current.filter(b => b !== brand);
                                            setEditedDetails({ ...editedDetails, specializations: updated });
                                        }}
                                    />
                                    {brand}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div style={fieldWrap}>
                        <label style={labelStyle}>New Password (leave blank to keep current)</label>
                        <input style={inputStyle} type="password" value={editedDetails.technicianPassword}
                            onChange={e => setEditedDetails({ ...editedDetails, technicianPassword: e.target.value })}
                            placeholder="Enter new password" />
                    </div>
                    <div style={fieldWrap}>
                        <label style={labelStyle}>Confirm New Password</label>
                        <input style={inputStyle} type="password" value={editedDetails.technicianPasswordConfirm}
                            onChange={e => setEditedDetails({ ...editedDetails, technicianPasswordConfirm: e.target.value })}
                            placeholder="Confirm new password" />
                    </div>
                    {errorMessage && <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{errorMessage}</p>}
                    <div style={btnRow}>
                        <button type="submit" style={btnPrimary}>Save Changes</button>
                        <button type="button" style={btnGhost} onClick={handleEditToggle}>Cancel</button>
                    </div>
                </form>
            </Drawer>
        </div>
    );
}

export default TechnicianProfile;
