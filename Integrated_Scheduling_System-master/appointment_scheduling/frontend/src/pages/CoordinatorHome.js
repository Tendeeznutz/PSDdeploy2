import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axiosConfig';
import { Modal, message } from 'antd';
import gsap from 'gsap';
import DeleteAppointmentPopup from '../components/DeleteAppointmentPopup';
import { StatusBadge } from '../components/StatusBadge';
import { staggerCards, staggerRowsFrom, counterAnimate } from '../utils/gsapHelpers';

const FF = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const ACCENT = '#4F81BD';
const PAGE_SIZE = 10;

const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
const travelLabel = (tt) => ({ own_vehicle: 'Own Vehicle', rented_vehicle: 'Rented Vehicle', company_vehicle: 'Company Vehicle' }[tt] || null);

/* ─── Toolbar button ──────────────────────────────────────────────────────── */
function TBtn({ children, onClick, active }) {
    return (
        <button onClick={onClick} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: active ? '#EEF4FB' : 'white', border: `1px solid ${active ? ACCENT : '#e5e7eb'}`,
            borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
            fontSize: 13, color: active ? ACCENT : '#374151', fontFamily: FF, fontWeight: active ? 600 : 400,
            whiteSpace: 'nowrap', transition: 'all 0.15s',
        }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#f9fafb'; } }}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'white'; } }}
        >
            {children}
        </button>
    );
}

/* ─── Column toggle dropdown ──────────────────────────────────────────────── */
function ColDropdown({ cols, visible, setVisible, isOpen, setIsOpen }) {
    return (
        <div className="action-menu-container" style={{ position: 'relative' }}>
            <TBtn onClick={() => setIsOpen(!isOpen)} active={isOpen}>⊞ Columns</TBtn>
            {isOpen && (
                <div onClick={e => e.stopPropagation()} style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300,
                    background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)', minWidth: 200, padding: '10px 0',
                }}>
                    <div style={{ padding: '6px 16px 8px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #f3f4f6', marginBottom: 4 }}>
                        Toggle Columns
                    </div>
                    {cols.map(col => (
                        <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer', fontSize: 13, color: '#374151' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <input type="checkbox" checked={visible.has(col)} style={{ accentColor: ACCENT }}
                                onChange={() => {
                                    const next = new Set(visible);
                                    if (next.has(col)) { if (next.size > 1) next.delete(col); }
                                    else next.add(col);
                                    setVisible(next);
                                }} />
                            {col}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─── Density dropdown ────────────────────────────────────────────────────── */
function DensityDropdown({ density, setDensity, isOpen, setIsOpen }) {
    return (
        <div className="action-menu-container" style={{ position: 'relative' }}>
            <TBtn onClick={() => setIsOpen(!isOpen)} active={isOpen}>≡ Density</TBtn>
            {isOpen && (
                <div onClick={e => e.stopPropagation()} style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300,
                    background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)', minWidth: 160, padding: '6px 0',
                }}>
                    {['Compact', 'Normal', 'Comfortable'].map(d => (
                        <button key={d} onClick={() => { setDensity(d.toLowerCase()); setIsOpen(false); }} style={{
                            display: 'block', width: '100%', padding: '9px 16px',
                            background: density === d.toLowerCase() ? '#EEF4FB' : 'none',
                            border: 'none', cursor: 'pointer', textAlign: 'left',
                            fontSize: 13, color: density === d.toLowerCase() ? ACCENT : '#374151',
                            fontWeight: density === d.toLowerCase() ? 600 : 400, fontFamily: FF,
                        }}
                            onMouseEnter={e => { if (density !== d.toLowerCase()) e.currentTarget.style.background = '#f9fafb'; }}
                            onMouseLeave={e => { if (density !== d.toLowerCase()) e.currentTarget.style.background = 'none'; }}
                        >{d}</button>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─── Shared table header cell style ─────────────────────────────────────── */
const TH_STYLE = { padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#6b7280', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' };

function getTD(density) {
    if (density === 'compact') return { padding: '8px 12px', fontSize: 13 };
    if (density === 'comfortable') return { padding: '18px 20px', fontSize: 15 };
    return { padding: '14px 16px', fontSize: 14 };
}

/* ─── Pagination footer ───────────────────────────────────────────────────── */
function PageFooter({ page, setPage, total, totalPages, label }) {
    return (
        <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f3f4f6', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#9ca3af', fontFamily: FF }}>
                {total === 0 ? `No ${label}` : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} ${label}`}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1, fontFamily: FF }}
                    disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span style={{ fontSize: 13, color: '#6b7280', padding: '6px 4px', fontFamily: FF }}>{page} / {totalPages}</span>
                <button style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, fontFamily: FF }}
                    disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
        </div>
    );
}

/* ─── Action row menu item ────────────────────────────────────────────────── */
function ActionItem({ icon, label, onClick, danger }) {
    return (
        <button onClick={onClick} style={{
            display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 16px',
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
            color: danger ? '#b91c1c' : '#374151', textAlign: 'left', fontFamily: FF,
        }}
            onMouseEnter={e => e.currentTarget.style.background = danger ? '#fff5f5' : '#f9fafb'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
            <span style={{ fontSize: 15 }}>{icon}</span> {label}
        </button>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  CoordinatorHome                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */
function CoordinatorHome() {
    const navigate = useNavigate();

    /* ── All existing state (preserved exactly) ────────────────────────── */
    const [appointments, setAppointments] = useState([]);
    const [filterStatus, setFilterStatus] = useState('');
    const [searchType, setSearchType] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [customers, setCustomers] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [reschedAppts, setReschedAppts] = useState([]);
    const [reschedApptID, setReschedApptID] = useState([]);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [technicianSearchQuery, setTechnicianSearchQuery] = useState('');
    const [rescheduleSearchQuery, setRescheduleSearchQuery] = useState('');
    const [formattedTime, setFormattedTime] = useState([]);
    const [customerSearchType, setCustomerSearchType] = useState('');
    const [technicianSearchType, setTechnicianSearchType] = useState('');
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [deleteAppointmentId, setDeleteAppointmentId] = useState('');
    const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
    const [resetPasswordTechnician, setResetPasswordTechnician] = useState(null);
    const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
    const [showCustomerResetPasswordModal, setShowCustomerResetPasswordModal] = useState(false);
    const [resetPasswordCustomer, setResetPasswordCustomer] = useState(null);
    const [resetPasswordCustomerLoading, setResetPasswordCustomerLoading] = useState(false);
    const [showToggleActiveModal, setShowToggleActiveModal] = useState(false);
    const [toggleActiveTechnician, setToggleActiveTechnician] = useState(null);
    const [toggleActiveLoading, setToggleActiveLoading] = useState(false);
    const [deactivationReason, setDeactivationReason] = useState('');
    const [showDeleteCustomerModal, setShowDeleteCustomerModal] = useState(false);
    const [deleteCustomer, setDeleteCustomer] = useState(null);
    const [deleteCustomerLoading, setDeleteCustomerLoading] = useState(false);
    const [deleteCustomerConfirmText, setDeleteCustomerConfirmText] = useState('');

    /* ── New UI state ─────────────────────────────────────────────────── */
    const [apptPage, setApptPage] = useState(1);
    const [custPage, setCustPage] = useState(1);
    const [techPage, setTechPage] = useState(1);
    const [apptSearch, setApptSearch] = useState('');
    const [custSearch, setCustSearch] = useState('');
    const [techSearch, setTechSearch] = useState('');
    const [openMenu, setOpenMenu] = useState(null);
    const [density, setDensity] = useState('normal');
    const [showApptFilters, setShowApptFilters] = useState(true);
    const [apptColOpen, setApptColOpen] = useState(false);
    const [custColOpen, setCustColOpen] = useState(false);
    const [techColOpen, setTechColOpen] = useState(false);
    const [apptDensOpen, setApptDensOpen] = useState(false);
    const [custDensOpen, setCustDensOpen] = useState(false);
    const [techDensOpen, setTechDensOpen] = useState(false);
    const [apptFS, setApptFS] = useState(false);
    const [custFS, setCustFS] = useState(false);
    const [techFS, setTechFS] = useState(false);

    /* ── Column definitions & visibility ──────────────────────────────── */
    const APPT_COLS = ['ID', 'Date/Time', 'Customer', 'Technician', 'Aircon Name', 'Aircon Brand/Model', 'Feedback', 'Payment', 'Status'];
    const CUST_COLS = ['Customer Name', 'Postal Code', 'Address', 'Phone', 'Email'];
    const TECH_COLS = ['Name', 'Postal Code', 'Address', 'Phone', 'Status', 'Travel Type', 'Specializations', 'Employment Status'];

    const [apptCols, setApptCols] = useState(() => new Set(APPT_COLS));
    const [custCols, setCustCols] = useState(() => new Set(CUST_COLS));
    const [techCols, setTechCols] = useState(() => new Set(TECH_COLS));

    /* ── Stat counter refs ────────────────────────────────────────────── */
    const statRef0 = useRef(null);
    const statRef1 = useRef(null);
    const statRef2 = useRef(null);

    /* ── All existing functions (preserved exactly) ────────────────────── */
    const fetchAppointments = async () => {
        let url = `/api/appointments/`;
        if (filterStatus) url += `?appointmentStatus=${filterStatus}`;
        if (searchQuery) {
            switch (searchType) {
                case 'customerName': url = `/api/appointments/?customerName=${searchQuery}`; break;
                case 'customerPhone': url = `/api/appointments/?customerPhone=${searchQuery}`; break;
                case 'customerEmail': url = `/api/appointments/?customerEmail=${searchQuery}`; break;
                case 'customerPostal': url = `/api/appointments/?customerPostalCode=${searchQuery}`; break;
                case 'technicianName': url = `/api/appointments/?technicianName=${searchQuery}`; break;
                case 'technicianPhone': url = `/api/appointments/?technicianPhone=${searchQuery}`; break;
                case 'technicianPostal': url = `/api/appointments/?technicianPostalCode=${searchQuery}`; break;
                case 'date': url = `/api/appointments/?appointmentStartTime=${searchQuery}`; break;
                default: break;
            }
        }
        try { const r = await api.get(url); setAppointments(r.data); }
        catch (e) { console.error('Error fetching appointments!', e); }
    };

    useEffect(() => {
        const fetchCustomers = async () => {
            let url = `/api/customers/`;
            if (customerSearchQuery && customerSearchType) {
                const p = { customerName: 'customerName', customerPhone: 'customerPhone', customerEmail: 'customerEmail', customerPostal: 'customerPostalCode' }[customerSearchType];
                if (p) url += `?${p}=${customerSearchQuery}`;
            }
            try { const r = await api.get(url); setCustomers(r.data); }
            catch (e) { console.error('Error fetching customers!', e); }
        };
        const fetchTechnicians = async () => {
            let url = `/api/technicians/`;
            if (technicianSearchQuery && technicianSearchType) {
                const p = { technicianName: 'technicianName', technicianPhone: 'technicianPhone', technicianPostal: 'technicianPostalCode', technicianTravelType: 'technicianTravelType' }[technicianSearchType];
                if (p) url += `?${p}=${technicianSearchQuery}`;
            }
            try { const r = await api.get(url); setTechnicians(r.data); }
            catch (e) { console.error('Error fetching technicians!', e); }
        };
        fetchAppointments();
        fetchCustomers();
        fetchTechnicians();
    }, [filterStatus, searchType, searchQuery, customerSearchQuery, customerSearchType, technicianSearchQuery]);

    const handleOpenDeletePopup = (id) => { setDeleteAppointmentId(id); setShowDeletePopup(true); };
    const handleConfirmDelete = async () => {
        try { await api.delete(`/api/appointments/${deleteAppointmentId}/`); fetchAppointments(); }
        catch (e) { console.error('Error deleting appointment!', e); }
        setShowDeletePopup(false);
    };
    const handleCancelDelete = () => setShowDeletePopup(false);

    const handleOpenResetPasswordModal = (t) => { setResetPasswordTechnician(t); setShowResetPasswordModal(true); };
    const handleCancelResetPassword = () => { setShowResetPasswordModal(false); setResetPasswordTechnician(null); };
    const handleConfirmResetPassword = async () => {
        if (!resetPasswordTechnician) return;
        setResetPasswordLoading(true);
        try {
            const r = await api.post(`/api/technicians/${resetPasswordTechnician.id}/coordinator-reset-password/`);
            message.success(`Password for ${r.data.technicianName} reset to password123`);
            setShowResetPasswordModal(false); setResetPasswordTechnician(null);
        } catch (e) { message.error('Failed to reset password. Please try again.'); }
        finally { setResetPasswordLoading(false); }
    };

    const handleOpenCustomerResetPasswordModal = (c) => { setResetPasswordCustomer(c); setShowCustomerResetPasswordModal(true); };
    const handleCancelCustomerResetPassword = () => { setShowCustomerResetPasswordModal(false); setResetPasswordCustomer(null); };
    const handleConfirmCustomerResetPassword = async () => {
        if (!resetPasswordCustomer) return;
        setResetPasswordCustomerLoading(true);
        try {
            const r = await api.post(`/api/customers/${resetPasswordCustomer.id}/coordinator-reset-password/`);
            message.success(`Password for ${r.data.customerName} reset. Email sent.`);
            setShowCustomerResetPasswordModal(false); setResetPasswordCustomer(null);
        } catch (e) { message.error('Failed to reset customer password. Please try again.'); }
        finally { setResetPasswordCustomerLoading(false); }
    };

    const handleOpenToggleActiveModal = (t) => { setToggleActiveTechnician(t); setDeactivationReason(''); setShowToggleActiveModal(true); };
    const handleCancelToggleActive = () => { setShowToggleActiveModal(false); setToggleActiveTechnician(null); setDeactivationReason(''); };
    const handleConfirmToggleActive = async () => {
        if (!toggleActiveTechnician) return;
        setToggleActiveLoading(true);
        try {
            const r = await api.post(`/api/technicians/${toggleActiveTechnician.id}/toggle-active-status/`, { reason: deactivationReason });
            message.success(r.data.isActive ? `${r.data.technicianName} reactivated` : `${r.data.technicianName} deactivated`);
            const tr = await api.get(`/api/technicians/`); setTechnicians(tr.data);
            setShowToggleActiveModal(false); setToggleActiveTechnician(null); setDeactivationReason('');
        } catch (e) { message.error('Failed to update technician status.'); }
        finally { setToggleActiveLoading(false); }
    };
    const handleToggleStatus = async (tech) => {
        try {
            const r = await api.post(`/api/technicians/${tech.id}/toggle-status/`);
            message.success(`${r.data.technicianName} is now ${r.data.technicianStatus === '1' ? 'Available' : 'Unavailable'}`);
            const tr = await api.get(`/api/technicians/`); setTechnicians(tr.data);
        } catch (e) { message.error('Failed to update technician status.'); }
    };

    const handleOpenDeleteCustomerModal = (customer) => {
        setDeleteCustomer(customer);
        setDeleteCustomerConfirmText('');
        setShowDeleteCustomerModal(true);
    };
    const handleCancelDeleteCustomer = () => {
        setShowDeleteCustomerModal(false);
        setDeleteCustomer(null);
        setDeleteCustomerConfirmText('');
    };
    const handleConfirmDeleteCustomer = async () => {
        if (!deleteCustomer || deleteCustomerConfirmText !== 'DELETE') return;
        setDeleteCustomerLoading(true);
        try {
            await api.delete(`/api/customers/${deleteCustomer.id}/`);
            message.success(`Customer account for ${deleteCustomer.customerName} has been permanently deleted.`);
            const custResponse = await api.get(`/api/customers/`);
            setCustomers(custResponse.data);
            fetchAppointments();
            setShowDeleteCustomerModal(false);
            setDeleteCustomer(null);
            setDeleteCustomerConfirmText('');
        } catch (e) {
            console.error('Error deleting customer account:', e);
            message.error('Failed to delete customer account. Please try again.');
        } finally {
            setDeleteCustomerLoading(false);
        }
    };

    function formatUnixTimestamp(ts) {
        const d = new Date(ts * 1000);
        return d.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true });
    }
    const handleStatusChange = (e) => setFilterStatus(e.target.value);
    const handleSearchTypeChange = (e) => setSearchType(e.target.value);
    const handleSearchQueryChange = (e) => setSearchQuery(e.target.value);
    const handleCustomerSearchQueryChange = (e) => setCustomerSearchQuery(e.target.value);
    const handleCustomerSearchTypeChange = (e) => setCustomerSearchType(e.target.value);
    const handleTechnicianSearchQueryChange = (e) => setTechnicianSearchQuery(e.target.value);
    const handleTechnicianSearchTypeChange = (e) => setTechnicianSearchType(e.target.value);
    const handleRescheduleSearchQuery = (e) => setRescheduleSearchQuery(e.target.value);
    const getStatusClass = (s) => ({ Pending: 'text-orange-500', Confirmed: 'text-green-500', Completed: 'text-blue-500', Cancelled: 'text-red-500' }[s] || 'text-gray-500');

    /* ── Close dropdowns on outside click ─────────────────────────────── */
    useEffect(() => {
        const close = (e) => {
            if (!e.target.closest('.action-menu-container')) {
                setOpenMenu(null);
                setApptColOpen(false); setCustColOpen(false); setTechColOpen(false);
                setApptDensOpen(false); setCustDensOpen(false); setTechDensOpen(false);
            }
        };
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, []);

    /* ── GSAP: stat cards + counters ──────────────────────────────────── */
    useEffect(() => {
        if (customers.length === 0 && technicians.length === 0) return;
        const activeTech = technicians.filter(t => t.isActive !== false).length;
        const timer = setTimeout(() => {
            const statCards = document.querySelectorAll('.stat-card');
            if (statCards.length > 0) {
                gsap.killTweensOf(statCards);
                staggerCards(statCards);
            }
        }, 50);

        counterAnimate(statRef0.current, customers.length, 0.3);
        counterAnimate(statRef1.current, technicians.length, 0.3);
        counterAnimate(statRef2.current, activeTech, 0.3);
        return () => clearTimeout(timer);
    }, [customers, technicians]);

    useEffect(() => {
        if (appointments.length === 0) return;
        const timer = setTimeout(() => {
            const rows = document.querySelectorAll('.appt-coord-row');
            if (rows.length > 0) staggerRowsFrom(rows);
        }, 50);
        return () => clearTimeout(timer);
    }, [appointments, apptPage]);

    useEffect(() => {
        if (customers.length === 0) return;
        const timer = setTimeout(() => {
            const rows = document.querySelectorAll('.customer-row');
            if (rows.length > 0) staggerRowsFrom(rows);
        }, 50);
        return () => clearTimeout(timer);
    }, [customers, custPage]);

    useEffect(() => {
        if (technicians.length === 0) return;
        const timer = setTimeout(() => {
            const rows = document.querySelectorAll('.technician-row');
            if (rows.length > 0) staggerRowsFrom(rows);
        }, 50);
        return () => clearTimeout(timer);
    }, [technicians, techPage]);

    /* ── Computed values ──────────────────────────────────────────────── */
    const activeTechCount = useMemo(() => technicians.filter(t => t.isActive !== false).length, [technicians]);

    const STATUS_FILTERS = [
        { label: 'All', value: '' },
        { label: 'Pending', value: '1' },
        { label: 'Confirmed', value: '2' },
        { label: 'Completed', value: '3' },
        { label: 'Cancelled', value: '4' },
    ];

    const filteredAppts = useMemo(() => {
        if (!apptSearch) return appointments;
        const q = apptSearch.toLowerCase();
        return appointments.filter(a =>
            String(a.id).includes(q) ||
            formatUnixTimestamp(a.appointmentStartTime).toLowerCase().includes(q) ||
            (a.display?.customerName || '').toLowerCase().includes(q) ||
            (a.display?.technicianName || '').toLowerCase().includes(q) ||
            (a.display?.appointmentStatus || '').toLowerCase().includes(q) ||
            (a.customerFeedback || '').toLowerCase().includes(q) ||
            (a.display?.paymentMethod || '').toLowerCase().includes(q)
        );
    }, [appointments, apptSearch]);

    const filteredCusts = useMemo(() => {
        if (!custSearch) return customers;
        const q = custSearch.toLowerCase();
        return customers.filter(c =>
            (c.customerName || '').toLowerCase().includes(q) ||
            (c.customerEmail || '').toLowerCase().includes(q) ||
            (c.customerPhone || '').toLowerCase().includes(q) ||
            (c.customerPostalCode || '').toLowerCase().includes(q) ||
            (c.customerAddress || '').toLowerCase().includes(q)
        );
    }, [customers, custSearch]);

    const filteredTechs = useMemo(() => {
        if (!techSearch) return technicians;
        const q = techSearch.toLowerCase();
        return technicians.filter(t =>
            (t.technicianName || '').toLowerCase().includes(q) ||
            (t.technicianPhone || '').toLowerCase().includes(q) ||
            (t.technicianPostalCode || '').toLowerCase().includes(q) ||
            (t.technicianAddress || '').toLowerCase().includes(q)
        );
    }, [technicians, techSearch]);

    const paginatedAppts = filteredAppts.slice((apptPage - 1) * PAGE_SIZE, apptPage * PAGE_SIZE);
    const paginatedCusts = filteredCusts.slice((custPage - 1) * PAGE_SIZE, custPage * PAGE_SIZE);
    const paginatedTechs = filteredTechs.slice((techPage - 1) * PAGE_SIZE, techPage * PAGE_SIZE);
    const totalApptPages = Math.max(1, Math.ceil(filteredAppts.length / PAGE_SIZE));
    const totalCustPages = Math.max(1, Math.ceil(filteredCusts.length / PAGE_SIZE));
    const totalTechPages = Math.max(1, Math.ceil(filteredTechs.length / PAGE_SIZE));

    const today = new Date().toLocaleDateString('en-SG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const tdStyle = getTD(density);
    const TD = { ...tdStyle, color: '#374151', verticalAlign: 'middle' };
    const avatarStyle = { width: 34, height: 34, borderRadius: '50%', background: '#EEF4FB', color: ACCENT, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };

    const fsStyle = (on) => on ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'white', overflow: 'auto', borderRadius: 0 } : {};

    /* ── STAT CARD DEFINITIONS ─────────────────────────────────────────── */
    const statCards = [
        {
            label: 'Total Customers', value: customers.length, ref: statRef0,
            sub: 'Registered accounts', icon: '👥',
            iconBg: '#EEF4FB', iconColor: ACCENT,
            borderColor: '#bfdbfe', accentLine: ACCENT,
        },
        {
            label: 'Total Technicians', value: technicians.length, ref: statRef1,
            sub: 'In the system', icon: '🔧',
            iconBg: '#f0fdf4', iconColor: '#15803d',
            borderColor: '#bbf7d0', accentLine: '#22c55e',
        },
        {
            label: 'Active Technicians', value: activeTechCount, ref: statRef2,
            sub: 'Currently employed', icon: '✅',
            iconBg: '#fefce8', iconColor: '#b45309',
            borderColor: '#fde68a', accentLine: '#f59e0b',
        },
    ];

    return (
        <div style={{ background: '#f5f6fa', minHeight: '100vh', fontFamily: FF }}>

            {/* ════════════════════════ STATS HERO ════════════════════════ */}
            <div className="dash-hero" style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '36px 48px 40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                    <div>
                        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', margin: 0 }}>Dashboard</h1>
                        <p style={{ fontSize: 14, color: '#9ca3af', margin: '4px 0 0' }}>{today}</p>
                    </div>
                    <button
                        style={{ background: ACCENT, color: 'white', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FF, display: 'flex', alignItems: 'center', gap: 7 }}
                        onClick={() => navigate('/coordinator/mailbox')}
                        onMouseEnter={e => e.currentTarget.style.background = '#3b6fa8'}
                        onMouseLeave={e => e.currentTarget.style.background = ACCENT}
                    >
                        ✉ Mailbox
                    </button>
                </div>

                <div className="stat-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                    {statCards.map((card, i) => (
                        <div
                            key={i}
                            className="stat-card"
                            style={{
                                background: 'white', borderRadius: 16,
                                border: `1.5px solid ${card.borderColor}`,
                                padding: '26px 28px', cursor: 'default',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                                position: 'relative', overflow: 'hidden',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-5px)';
                                e.currentTarget.style.boxShadow = '0 14px 36px rgba(0,0,0,0.12)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                            }}
                        >
                            {/* Top accent bar */}
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: card.accentLine, borderRadius: '16px 16px 0 0' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <p style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                                        {card.label}
                                    </p>
                                    <div
                                        ref={card.ref}
                                        style={{ fontSize: 44, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.04em', lineHeight: 1.1, marginTop: 8 }}
                                    >
                                        {card.value}
                                    </div>
                                    <p style={{ fontSize: 13, color: '#9ca3af', margin: '6px 0 0' }}>{card.sub}</p>
                                </div>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                                    {card.icon}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ════════════════════════ CONTENT ════════════════════════ */}
            <div className="dash-section" style={{ padding: '36px 48px' }}>

                {/* ────────────── APPOINTMENTS ────────────── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Appointments</h2>
                        <p style={{ fontSize: 13, color: '#9ca3af', margin: '3px 0 0' }}>All scheduled service appointments</p>
                    </div>
                    <span style={{ background: '#EEF4FB', color: ACCENT, padding: '5px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 700 }}>
                        {appointments.length} total
                    </span>
                </div>

                <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 44, ...fsStyle(apptFS) }}>
                    {/* Status filter pills */}
                    {showApptFilters && (
                        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Status:</span>
                            {STATUS_FILTERS.map(f => (
                                <button key={f.value} onClick={() => { setFilterStatus(f.value); setApptPage(1); }}
                                    style={{ borderRadius: 9999, padding: '5px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: FF, background: filterStatus === f.value ? ACCENT : '#f3f4f6', color: filterStatus === f.value ? 'white' : '#6b7280', transition: 'all 0.15s' }}>
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Toolbar */}
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <span style={{ position: 'absolute', left: 10, color: '#9ca3af', fontSize: 15 }}>🔍</span>
                            <input style={{ padding: '8px 12px 8px 34px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, width: 240, fontFamily: FF, outline: 'none', color: '#0f172a' }}
                                placeholder="Search appointments…" value={apptSearch}
                                onChange={e => { setApptSearch(e.target.value); setApptPage(1); }} />
                        </div>
                        <TBtn onClick={() => setShowApptFilters(!showApptFilters)} active={showApptFilters}>
                            ≋ {showApptFilters ? 'Hide' : 'Show'} Filters
                        </TBtn>
                        <div className="action-menu-container">
                            <ColDropdown cols={APPT_COLS} visible={apptCols} setVisible={setApptCols} isOpen={apptColOpen} setIsOpen={setApptColOpen} />
                        </div>
                        <div className="action-menu-container">
                            <DensityDropdown density={density} setDensity={setDensity} isOpen={apptDensOpen} setIsOpen={setApptDensOpen} />
                        </div>
                        <TBtn onClick={() => setApptFS(!apptFS)} active={apptFS}>{apptFS ? '⊡ Exit' : '⛶ Fullscreen'}</TBtn>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {APPT_COLS.filter(c => apptCols.has(c)).map(h => <th key={h} style={TH_STYLE}>{h}</th>)}
                                    <th style={TH_STYLE}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedAppts.length === 0 ? (
                                    <tr><td colSpan={apptCols.size + 1} style={{ ...TD, textAlign: 'center', color: '#9ca3af', padding: '56px 16px', fontSize: 14 }}>No appointments found.</td></tr>
                                ) : paginatedAppts.map(appt => {
                                    const brands = appt.display?.airconBrand || [];
                                    const models = appt.display?.airconModel || [];
                                    const brandModel = brands.map((b, i) => [b, models[i]].filter(Boolean).join(' ')).join(', ') || '—';
                                    return (
                                        <tr key={appt.id} className="appt-coord-row"
                                            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            {apptCols.has('ID') && <td style={{ ...TD, fontWeight: 700, color: '#9ca3af', fontSize: tdStyle.fontSize - 1 }}>#{appt.id}</td>}
                                            {apptCols.has('Date/Time') && <td style={{ ...TD, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{formatUnixTimestamp(appt.appointmentStartTime)}</td>}
                                            {apptCols.has('Customer') && <td style={{ ...TD, fontWeight: 500, color: '#0f172a' }}>{appt.display?.customerName || '—'}</td>}
                                            {apptCols.has('Technician') && <td style={TD}>
                                                {appt.display?.technicianName
                                                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />{appt.display.technicianName}</span>
                                                    : <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600 }}>Unassigned</span>}
                                            </td>}
                                            {apptCols.has('Aircon Name') && <td style={{ ...TD, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.display?.airconToService || '—'}</td>}
                                            {apptCols.has('Aircon Brand/Model') && <td style={{ ...TD, color: '#6b7280' }}>{brandModel}</td>}
                                            {apptCols.has('Feedback') && <td style={{ ...TD, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: appt.customerFeedback ? 'normal' : 'italic', color: appt.customerFeedback ? '#374151' : '#9ca3af' }}>{appt.customerFeedback || 'No feedback'}</td>}
                                            {apptCols.has('Payment') && <td style={TD}>{appt.display?.paymentMethod || '—'}</td>}
                                            {apptCols.has('Status') && <td style={TD}><StatusBadge status={appt.display?.appointmentStatus} /></td>}
                                            <td style={TD}>
                                                <div className="action-menu-container" style={{ display: 'inline-block' }}>
                                                    <button style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', padding: '4px 10px', fontSize: 16, color: '#6b7280' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                        onClick={(e) => {
                                                            if (openMenu?.table === 'appt' && openMenu?.id === appt.id) { setOpenMenu(null); return; }
                                                            const r = e.currentTarget.getBoundingClientRect();
                                                            setOpenMenu({ table: 'appt', id: appt.id, top: r.bottom + 4, right: window.innerWidth - r.right });
                                                        }}>⋯</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <PageFooter page={apptPage} setPage={setApptPage} total={filteredAppts.length} totalPages={totalApptPages} label="appointments" />
                </div>

                {/* ────────────── CUSTOMERS ────────────── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Customers</h2>
                        <p style={{ fontSize: 13, color: '#9ca3af', margin: '3px 0 0' }}>All registered customer accounts</p>
                    </div>
                    <span style={{ background: '#f0fdf4', color: '#15803d', padding: '5px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 700 }}>
                        {customers.length} registered
                    </span>
                </div>

                <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 44, ...fsStyle(custFS) }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <span style={{ position: 'absolute', left: 10, color: '#9ca3af', fontSize: 15 }}>🔍</span>
                            <input style={{ padding: '8px 12px 8px 34px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, width: 240, fontFamily: FF, outline: 'none', color: '#0f172a' }}
                                placeholder="Search customers…" value={custSearch}
                                onChange={e => { setCustSearch(e.target.value); setCustPage(1); }} />
                        </div>
                        <div className="action-menu-container">
                            <ColDropdown cols={CUST_COLS} visible={custCols} setVisible={setCustCols} isOpen={custColOpen} setIsOpen={setCustColOpen} />
                        </div>
                        <div className="action-menu-container">
                            <DensityDropdown density={density} setDensity={setDensity} isOpen={custDensOpen} setIsOpen={setCustDensOpen} />
                        </div>
                        <TBtn onClick={() => setCustFS(!custFS)} active={custFS}>{custFS ? '⊡ Exit' : '⛶ Fullscreen'}</TBtn>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {CUST_COLS.filter(c => custCols.has(c)).map(h => <th key={h} style={TH_STYLE}>{h}</th>)}
                                    <th style={TH_STYLE}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedCusts.length === 0 ? (
                                    <tr><td colSpan={custCols.size + 1} style={{ ...TD, textAlign: 'center', color: '#9ca3af', padding: '56px 16px', fontSize: 14 }}>No customers found.</td></tr>
                                ) : paginatedCusts.map(cust => (
                                    <tr key={cust.id} className="customer-row"
                                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        {custCols.has('Customer Name') && (
                                            <td style={TD}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={avatarStyle}>{getInitials(cust.customerName)}</div>
                                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{cust.customerName}</span>
                                                </div>
                                            </td>
                                        )}
                                        {custCols.has('Postal Code') && <td style={TD}>{cust.customerPostalCode || '—'}</td>}
                                        {custCols.has('Address') && <td style={{ ...TD, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cust.customerAddress || '—'}</td>}
                                        {custCols.has('Phone') && <td style={{ ...TD, fontWeight: 500 }}>{cust.customerPhone || '—'}</td>}
                                        {custCols.has('Email') && <td style={{ ...TD, color: '#6b7280' }}>{cust.customerEmail || '—'}</td>}
                                        <td style={TD}>
                                            <div className="action-menu-container" style={{ display: 'inline-block' }}>
                                                <button style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', padding: '4px 10px', fontSize: 16, color: '#6b7280' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                    onClick={(e) => {
                                                        if (openMenu?.table === 'cust' && openMenu?.id === cust.id) { setOpenMenu(null); return; }
                                                        const r = e.currentTarget.getBoundingClientRect();
                                                        setOpenMenu({ table: 'cust', id: cust.id, top: r.bottom + 4, right: window.innerWidth - r.right });
                                                    }}>⋯</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <PageFooter page={custPage} setPage={setCustPage} total={filteredCusts.length} totalPages={totalCustPages} label="customers" />
                </div>

                {/* ────────────── TECHNICIANS ────────────── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Technicians</h2>
                        <p style={{ fontSize: 13, color: '#9ca3af', margin: '3px 0 0' }}>All technician accounts and their status</p>
                    </div>
                    <span style={{ background: '#f0fdf4', color: '#15803d', padding: '5px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 700 }}>
                        {technicians.length} in system
                    </span>
                </div>

                <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 24, ...fsStyle(techFS) }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <span style={{ position: 'absolute', left: 10, color: '#9ca3af', fontSize: 15 }}>🔍</span>
                            <input style={{ padding: '8px 12px 8px 34px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, width: 240, fontFamily: FF, outline: 'none', color: '#0f172a' }}
                                placeholder="Search technicians…" value={techSearch}
                                onChange={e => { setTechSearch(e.target.value); setTechPage(1); }} />
                        </div>
                        <div className="action-menu-container">
                            <ColDropdown cols={TECH_COLS} visible={techCols} setVisible={setTechCols} isOpen={techColOpen} setIsOpen={setTechColOpen} />
                        </div>
                        <div className="action-menu-container">
                            <DensityDropdown density={density} setDensity={setDensity} isOpen={techDensOpen} setIsOpen={setTechDensOpen} />
                        </div>
                        <TBtn onClick={() => setTechFS(!techFS)} active={techFS}>{techFS ? '⊡ Exit' : '⛶ Fullscreen'}</TBtn>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {TECH_COLS.filter(c => techCols.has(c)).map(h => <th key={h} style={TH_STYLE}>{h}</th>)}
                                    <th style={TH_STYLE}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedTechs.length === 0 ? (
                                    <tr><td colSpan={techCols.size + 1} style={{ ...TD, textAlign: 'center', color: '#9ca3af', padding: '56px 16px', fontSize: 14 }}>No technicians found.</td></tr>
                                ) : paginatedTechs.map(tech => {
                                    const tl = travelLabel(tech.technicianTravelType);
                                    const specs = tech.specializations || [];
                                    return (
                                        <tr key={tech.id} className="technician-row"
                                            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            {techCols.has('Name') && (
                                                <td style={TD}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div style={avatarStyle}>{getInitials(tech.technicianName)}</div>
                                                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{tech.technicianName}</span>
                                                    </div>
                                                </td>
                                            )}
                                            {techCols.has('Postal Code') && <td style={TD}>{tech.technicianPostalCode || '—'}</td>}
                                            {techCols.has('Address') && <td style={{ ...TD, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tech.technicianAddress || '—'}</td>}
                                            {techCols.has('Phone') && <td style={{ ...TD, fontWeight: 500 }}>{tech.technicianPhone || '—'}</td>}
                                            {techCols.has('Status') && <td style={TD}><StatusBadge status={tech.technicianStatus === '1' ? 'Available' : 'Unavailable'} /></td>}
                                            {techCols.has('Travel Type') && <td style={TD}>{tl ? <StatusBadge status={tl} /> : <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: 12 }}>Not set</span>}</td>}
                                            {techCols.has('Specializations') && (
                                                <td style={TD}>
                                                    {specs.length === 0
                                                        ? <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: 12 }}>None</span>
                                                        : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 220 }}>
                                                            {specs.map(s => <span key={s} style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 500 }}>{s}</span>)}
                                                        </div>}
                                                </td>
                                            )}
                                            {techCols.has('Employment Status') && <td style={TD}><StatusBadge status={tech.isActive !== false ? 'Active' : 'Inactive'} /></td>}
                                            <td style={TD}>
                                                <div className="action-menu-container" style={{ display: 'inline-block' }}>
                                                    <button style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', padding: '4px 10px', fontSize: 16, color: '#6b7280' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                        onClick={(e) => {
                                                            if (openMenu?.table === 'tech' && openMenu?.id === tech.id) { setOpenMenu(null); return; }
                                                            const r = e.currentTarget.getBoundingClientRect();
                                                            setOpenMenu({ table: 'tech', id: tech.id, top: r.bottom + 4, right: window.innerWidth - r.right });
                                                        }}>⋯</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <PageFooter page={techPage} setPage={setTechPage} total={filteredTechs.length} totalPages={totalTechPages} label="technicians" />
                </div>
            </div>

            {/* ════════════ FIXED-POSITION ACTION DROPDOWN ════════════ */}
            {openMenu && (() => {
                const dropStyle = {
                    position: 'fixed', top: openMenu.top, right: openMenu.right,
                    zIndex: 9999, background: 'white', border: '1px solid #e5e7eb',
                    borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                    padding: '6px 0',
                };
                if (openMenu.table === 'appt') {
                    const appt = appointments.find(a => a.id === openMenu.id);
                    if (!appt) return null;
                    return (
                        <div className="action-menu-container" style={{ ...dropStyle, minWidth: 200 }}>
                            <ActionItem icon="👁" label="View Details" onClick={() => { window.location.href = '/coordinator/appointmentView?id=' + appt.id; setOpenMenu(null); }} />
                            <ActionItem icon="✉" label="Send Enquiry" onClick={() => { window.location.href = '/coordinator/customerEnquiry?id=' + appt.customerId + '&name=' + appt.display.customerName; setOpenMenu(null); }} />
                            <ActionItem icon="✏️" label="Update" onClick={() => { window.location.href = '/coordinator/appointmentUpdate?id=' + appt.id; setOpenMenu(null); }} />
                            <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />
                            <ActionItem icon="🗑" label="Delete" danger onClick={() => { handleOpenDeletePopup(appt.id); setOpenMenu(null); }} />
                        </div>
                    );
                }
                if (openMenu.table === 'cust') {
                    const cust = customers.find(c => c.id === openMenu.id);
                    if (!cust) return null;
                    return (
                        <div className="action-menu-container" style={{ ...dropStyle, minWidth: 190 }}>
                            <ActionItem icon="🔑" label="Reset Password" onClick={() => { handleOpenCustomerResetPasswordModal(cust); setOpenMenu(null); }} />
                            <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />
                            <ActionItem icon="🗑" label="Delete Account" danger onClick={() => { handleOpenDeleteCustomerModal(cust); setOpenMenu(null); }} />
                        </div>
                    );
                }
                if (openMenu.table === 'tech') {
                    const tech = technicians.find(t => t.id === openMenu.id);
                    if (!tech) return null;
                    return (
                        <div className="action-menu-container" style={{ ...dropStyle, minWidth: 220 }}>
                            <ActionItem icon="🔑" label="Reset Password" onClick={() => { handleOpenResetPasswordModal(tech); setOpenMenu(null); }} />
                            <ActionItem icon={tech.technicianStatus === '1' ? '🔴' : '🟢'} label={tech.technicianStatus === '1' ? 'Set Unavailable' : 'Set Available'} onClick={() => { handleToggleStatus(tech); setOpenMenu(null); }} />
                            <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />
                            <ActionItem icon={tech.isActive !== false ? '🚫' : '✅'} label={tech.isActive !== false ? 'Deactivate Technician' : 'Reactivate Technician'} danger={tech.isActive !== false} onClick={() => { handleOpenToggleActiveModal(tech); setOpenMenu(null); }} />
                        </div>
                    );
                }
                return null;
            })()}

            {/* ════════════════════════ MODALS ════════════════════════ */}
            <DeleteAppointmentPopup visible={showDeletePopup} onCancel={handleCancelDelete} onConfirmDelete={handleConfirmDelete} />

            <Modal title="Reset Technician Password" open={showResetPasswordModal}
                onOk={handleConfirmResetPassword} onCancel={handleCancelResetPassword}
                okText="Reset Password" okButtonProps={{ danger: true, loading: resetPasswordLoading }}
                cancelButtonProps={{ disabled: resetPasswordLoading }}>
                <div style={{ padding: '16px 0' }}>
                    <p style={{ color: '#374151', marginBottom: 16 }}>Reset password for <strong>{resetPasswordTechnician?.technicianName}</strong>?</p>
                    <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                        <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>New password: <strong>password123</strong>. An email notification will be sent.</p>
                    </div>
                </div>
            </Modal>

            <Modal title={toggleActiveTechnician?.isActive !== false ? 'Deactivate Technician' : 'Reactivate Technician'}
                open={showToggleActiveModal} onOk={handleConfirmToggleActive} onCancel={handleCancelToggleActive}
                okText={toggleActiveTechnician?.isActive !== false ? 'Deactivate' : 'Reactivate'}
                okButtonProps={{ danger: toggleActiveTechnician?.isActive !== false, loading: toggleActiveLoading, style: toggleActiveTechnician?.isActive === false ? { backgroundColor: '#52c41a', borderColor: '#52c41a' } : {} }}
                cancelButtonProps={{ disabled: toggleActiveLoading }}>
                <div style={{ padding: '16px 0' }}>
                    {toggleActiveTechnician?.isActive !== false ? (
                        <>
                            <p style={{ color: '#374151', marginBottom: 16 }}>Deactivate <strong>{toggleActiveTechnician?.technicianName}</strong>? They will lose login access.</p>
                            <div style={{ padding: 12, background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 16 }}>
                                <p style={{ fontSize: 13, color: '#b91c1c', margin: 0 }}>Data is preserved and they can be reactivated later.</p>
                            </div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Reason (optional):</label>
                            <textarea style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: FF, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                                rows={3} placeholder="e.g., Contract ended, Resigned…"
                                value={deactivationReason} onChange={e => setDeactivationReason(e.target.value)} />
                        </>
                    ) : (
                        <>
                            <p style={{ color: '#374151', marginBottom: 16 }}>Reactivate <strong>{toggleActiveTechnician?.technicianName}</strong>? They will be able to log in again.</p>
                            <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                                <p style={{ fontSize: 13, color: '#15803d', margin: 0 }}>An email notification will be sent to the technician.</p>
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            <Modal title="Reset Customer Password" open={showCustomerResetPasswordModal}
                onOk={handleConfirmCustomerResetPassword} onCancel={handleCancelCustomerResetPassword}
                okText="Reset Password" okButtonProps={{ danger: true, loading: resetPasswordCustomerLoading }}
                cancelButtonProps={{ disabled: resetPasswordCustomerLoading }}>
                <div style={{ padding: '16px 0' }}>
                    <p style={{ color: '#374151', marginBottom: 16 }}>Reset password for <strong>{resetPasswordCustomer?.customerName}</strong>?</p>
                    <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                        <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>New password: <strong>password123</strong>. Email sent to {resetPasswordCustomer?.customerEmail}.</p>
                    </div>
                </div>
            </Modal>

            <Modal title="Delete Customer Account" open={showDeleteCustomerModal}
                onOk={handleConfirmDeleteCustomer} onCancel={handleCancelDeleteCustomer}
                okText="Delete Permanently" okButtonProps={{ danger: true, loading: deleteCustomerLoading, disabled: deleteCustomerConfirmText !== 'DELETE' }}
                cancelButtonProps={{ disabled: deleteCustomerLoading }}>
                <div style={{ padding: '16px 0' }}>
                    <p style={{ color: '#374151', marginBottom: 16 }}>
                        Permanently delete <strong>{deleteCustomer?.customerName}</strong>'s account?
                    </p>
                    <div style={{ padding: 12, background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 16 }}>
                        <p style={{ fontSize: 13, color: '#b91c1c', margin: 0 }}>
                            This action cannot be undone. All customer data and associated appointments will be permanently removed.
                        </p>
                    </div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                        Type <strong>DELETE</strong> to confirm:
                    </label>
                    <input
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: FF, outline: 'none', boxSizing: 'border-box' }}
                        value={deleteCustomerConfirmText}
                        onChange={e => setDeleteCustomerConfirmText(e.target.value)}
                        placeholder="DELETE"
                    />
                </div>
            </Modal>
        </div>
    );
}

export default CoordinatorHome;
