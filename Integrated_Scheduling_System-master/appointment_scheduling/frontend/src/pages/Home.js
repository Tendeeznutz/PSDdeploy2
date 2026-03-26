import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../axiosConfig';
import { useNavigate } from 'react-router-dom';
import { Modal, message } from 'antd';
import { StatusBadge } from '../components/StatusBadge';
import { fadeUp, staggerRows } from '../utils/gsapHelpers';

/* ─── Column toggle dropdown ────────────────────────────────────────────── */
const ALL_COLUMNS = ['Date/Time', 'Aircon', 'Feedback', 'Technician', 'Payment', 'Status', 'Actions'];

function ColumnDropdown({ visibleCols, onToggle, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    return (
        <div ref={ref} style={{
            position: 'absolute', top: '100%', right: 0, zIndex: 20, marginTop: 4,
            background: 'white', border: '1px solid #e5e7eb', borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)', padding: '8px 0', minWidth: 170,
        }}>
            <div style={{ padding: '6px 14px 8px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Columns
            </div>
            {ALL_COLUMNS.map(col => (
                <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, color: '#374151' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <input type="checkbox" checked={visibleCols.includes(col)} onChange={() => onToggle(col)}
                        style={{ accentColor: '#4F81BD', width: 14, height: 14 }} />
                    {col}
                </label>
            ))}
        </div>
    );
}

function Home() {
    const customer_id = localStorage.getItem('customers_id');
    const customer_name = localStorage.getItem('customers_name');
    const navigate = useNavigate();
    const tableContainerRef = useRef(null);

    /* ── Existing state ───────────────────────────────────────────────────── */
    const [appointmentList, setAppointmentList] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    /* ── UI-only state ────────────────────────────────────────────────────── */
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [showFilters, setShowFilters] = useState(true);
    const [showColDropdown, setShowColDropdown] = useState(false);
    const [visibleCols, setVisibleCols] = useState([...ALL_COLUMNS]);
    const [density, setDensity] = useState('normal'); // 'compact' | 'normal' | 'comfortable'
    const [isFullscreen, setIsFullscreen] = useState(false);
    const pageSize = 10;

    const densityPad = { compact: '9px 14px', normal: '14px 16px', comfortable: '19px 16px' };
    const densityFont = { compact: 13, normal: 14, comfortable: 15 };

    /* ── Existing handlers (preserved exactly) ───────────────────────────── */
    const goToReportIssues = () => { navigate('/customer/ReportIssues'); };
    const goToMailbox = () => { navigate('/customer/mailbox'); };

    const handleCancelAppointment = async (appointmentId, appointmentStartTime) => {
        const now = Math.floor(Date.now() / 1000);
        const hoursUntilAppointment = (appointmentStartTime - now) / 3600;
        if (hoursUntilAppointment < 48) {
            message.error('Cannot cancel appointment within 48 hours of scheduled time');
            return;
        }
        Modal.confirm({
            title: 'Cancel Appointment',
            content: 'Are you sure you want to cancel this appointment?',
            okText: 'Yes, Cancel',
            okType: 'danger',
            cancelText: 'No, Keep It',
            onOk: async () => {
                try {
                    await api.patch(`/api/appointments/${appointmentId}/`, {
                        appointmentStatus: '4',
                        cancellationReason: 'Cancelled by customer',
                        cancelledBy: 'customer'
                    });
                    message.success('Appointment cancelled successfully');
                    const response = await getAllAppointments();
                    setAppointmentList(response.data);
                } catch (error) {
                    console.error('Error cancelling appointment:', error);
                    message.error('Failed to cancel appointment. Please try again.');
                }
            }
        });
    };

    const fetchUnreadCount = async () => {
        try {
            const response = await api.get('/api/messages/unread-count/', {
                params: { recipientId: customer_id, recipientType: 'customer' }
            });
            setUnreadCount(response.data.unreadCount);
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    };

    const getAllAppointments = () => {
        try {
            return api.get(`/api/appointments/?customerId=${customer_id}`);
        } catch (error) {
            console.error(error.message);
        }
    };

    function formatUnixTimestamp(unixTimestamp) {
        const date = new Date(unixTimestamp * 1000);
        return date.toLocaleString('en-US', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    }

    useEffect(() => {
        if (!customer_id) {
            navigate('/error');
        } else {
            getAllAppointments().then((response) => {
                setAppointmentList(response.data);
            });
            fetchUnreadCount();
        }
    }, [customer_id, navigate]);

    useEffect(() => {
        if (!appointmentList || appointmentList.length === 0) return;
        const timer = setTimeout(() => {
            const rows = document.querySelectorAll('.appt-row');
            if (rows.length > 0) {
                staggerRows(rows, 0.1);
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [appointmentList]);

    useEffect(() => {
        const timer = setTimeout(() => {
            const hero = document.querySelectorAll('.customer-hero');
            if (hero.length > 0) {
                fadeUp(hero);
            }
        }, 50);
        return () => clearTimeout(timer);
    }, []);

    /* ── Fullscreen toggle ───────────────────────────────────────────────── */
    const toggleFullscreen = () => {
        if (!isFullscreen) {
            tableContainerRef.current?.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
        setIsFullscreen(v => !v);
    };

    useEffect(() => {
        const handler = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    /* ── Column toggle ───────────────────────────────────────────────────── */
    const toggleCol = (col) => {
        setVisibleCols(prev =>
            prev.includes(col) ? (prev.length > 1 ? prev.filter(c => c !== col) : prev) : [...prev, col]
        );
    };

    /* ── Filtered & paginated data ───────────────────────────────────────── */
    const filtered = useMemo(() => {
        return appointmentList.filter(appt => {
            const matchStatus = statusFilter === 'All' || appt.display?.appointmentStatus === statusFilter;
            const q = search.toLowerCase();
            const matchSearch = !q ||
                formatUnixTimestamp(appt.appointmentStartTime).toLowerCase().includes(q) ||
                (appt.display?.technicianName || '').toLowerCase().includes(q) ||
                (appt.display?.airconToService || '').toLowerCase().includes(q) ||
                (appt.display?.appointmentStatus || '').toLowerCase().includes(q) ||
                (appt.customerFeedback || '').toLowerCase().includes(q) ||
                (appt.display?.paymentMethod || '').toLowerCase().includes(q);
            return matchStatus && matchSearch;
        });
    }, [appointmentList, search, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const rangeEnd = Math.min(currentPage * pageSize, filtered.length);

    const STATUS_FILTERS = ['All', 'Confirmed', 'Pending', 'Completed', 'Cancelled'];

    const DENSITY_OPTS = [
        { key: 'compact', label: 'Compact' },
        { key: 'normal', label: 'Normal' },
        { key: 'comfortable', label: 'Comfortable' },
    ];

    const tdPad = densityPad[density];
    const tdFont = densityFont[density];

    /* ── Shared icon button style ────────────────────────────────────────── */
    const iconBtn = (active) => ({
        background: active ? '#EEF4FB' : 'white',
        border: '1px solid ' + (active ? '#4F81BD' : '#e5e7eb'),
        borderRadius: 8, padding: '7px 11px', fontSize: 13,
        cursor: 'pointer', fontFamily: 'inherit', color: active ? '#4F81BD' : '#374151',
        display: 'flex', alignItems: 'center', gap: 5, fontWeight: active ? 600 : 400,
        whiteSpace: 'nowrap',
    });

    return (
        <div style={{ background: '#fafafa', minHeight: '100vh', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
            {/* ── Hero ──────────────────────────────────────────────────────── */}
            <div className="customer-hero dash-hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '32px 40px', background: 'white', borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <p style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', margin: 0 }}>
                        Welcome back, {customer_name || 'Customer'}
                    </p>
                    <p style={{ fontSize: 15, color: '#6b7280', marginTop: 6, margin: '6px 0 0' }}>
                        You have <strong style={{ color: '#0f172a' }}>{appointmentList.length}</strong> upcoming appointment{appointmentList.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button
                        style={{ background: '#4F81BD', color: 'white', borderRadius: 8, padding: '11px 22px', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#3a6a9e'}
                        onMouseLeave={e => e.currentTarget.style.background = '#4F81BD'}
                        onClick={() => navigate('/customer/scheduleAppointment')}>
                        Book New Appointment
                    </button>
                    <button
                        style={{ background: 'white', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '11px 22px', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                        onClick={goToReportIssues}>
                        Report Issues
                    </button>
                </div>
            </div>

            {/* ── Appointments section ──────────────────────────────────────── */}
            <div className="dash-section" style={{ padding: '28px 40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Upcoming Appointments</h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{ position: 'relative', background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', color: '#374151' }} onClick={goToMailbox}>
                            ✉ Messages
                            {unreadCount > 0 && (
                                <span style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: 'white', borderRadius: 9999, fontSize: 10, fontWeight: 700, padding: '2px 6px', lineHeight: 1.2 }}>{unreadCount}</span>
                            )}
                        </button>
                    </div>
                </div>

                <div ref={tableContainerRef} style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    {/* ── Toolbar ─────────────────────────────────────────── */}
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {/* Search */}
                        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flex: '1 1 200px', maxWidth: 260 }}>
                            <span style={{ position: 'absolute', left: 10, color: '#9ca3af', pointerEvents: 'none', fontSize: 14 }}>🔍</span>
                            <input
                                style={{ padding: '8px 12px 8px 34px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, width: '100%', background: 'white', outline: 'none', fontFamily: 'inherit', color: '#0f172a' }}
                                placeholder="Search appointments…"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                            />
                        </div>

                        {/* Divider */}
                        <div style={{ width: 1, height: 28, background: '#e5e7eb' }} />

                        {/* Show/hide filter pills */}
                        <button style={iconBtn(showFilters)} onClick={() => setShowFilters(v => !v)}>
                            ⚙ Filter
                        </button>

                        {/* Column toggle */}
                        <div style={{ position: 'relative' }}>
                            <button style={iconBtn(showColDropdown)} onClick={() => setShowColDropdown(v => !v)}>
                                ⬜ Columns
                            </button>
                            {showColDropdown && (
                                <ColumnDropdown
                                    visibleCols={visibleCols}
                                    onToggle={toggleCol}
                                    onClose={() => setShowColDropdown(false)}
                                />
                            )}
                        </div>

                        {/* Density */}
                        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3, gap: 2 }}>
                            {DENSITY_OPTS.map(d => (
                                <button key={d.key}
                                    style={{
                                        padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: density === d.key ? 600 : 400,
                                        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                        background: density === d.key ? 'white' : 'transparent',
                                        color: density === d.key ? '#0f172a' : '#6b7280',
                                        boxShadow: density === d.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                        transition: 'all 0.15s',
                                    }}
                                    onClick={() => setDensity(d.key)}>
                                    {d.label}
                                </button>
                            ))}
                        </div>

                        {/* Fullscreen */}
                        <button style={iconBtn(isFullscreen)} onClick={toggleFullscreen} title="Toggle fullscreen">
                            {isFullscreen ? '⤡' : '⤢'} {isFullscreen ? 'Exit' : 'Fullscreen'}
                        </button>
                    </div>

                    {/* ── Status filter pills ──────────────────────────────── */}
                    {showFilters && (
                        <div style={{ padding: '10px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, marginRight: 4 }}>STATUS</span>
                            {STATUS_FILTERS.map(f => (
                                <button key={f}
                                    style={{
                                        borderRadius: 9999, padding: '5px 16px', fontSize: 13, fontWeight: 500,
                                        cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                                        background: statusFilter === f ? '#4F81BD' : '#f3f4f6',
                                        color: statusFilter === f ? 'white' : '#6b7280',
                                        transition: 'all 0.15s',
                                    }}
                                    onClick={() => { setStatusFilter(f); setCurrentPage(1); }}>
                                    {f}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Table ───────────────────────────────────────────── */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                                    {visibleCols.includes('Date/Time') && <th style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Appointment Date/Time</th>}
                                    {visibleCols.includes('Aircon') && <th style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Aircon to be serviced</th>}
                                    {visibleCols.includes('Feedback') && <th style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Feedback</th>}
                                    {visibleCols.includes('Technician') && <th style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Technician</th>}
                                    {visibleCols.includes('Payment') && <th style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Payment</th>}
                                    {visibleCols.includes('Status') && <th style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Status</th>}
                                    {visibleCols.includes('Actions') && <th style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleCols.length} style={{ padding: '48px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                                            No appointments found.
                                        </td>
                                    </tr>
                                ) : paginated.map(appt => {
                                    const now = Math.floor(Date.now() / 1000);
                                    const hoursUntil = (appt.appointmentStartTime - now) / 3600;
                                    const status = appt.appointmentStatus;
                                    const canCancel = hoursUntil >= 48 && (status === '1' || status === '2');
                                    return (
                                        <tr key={appt.id} className="appt-row"
                                            style={{ borderBottom: '1px solid #f9fafb' }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            {visibleCols.includes('Date/Time') && (
                                                <td style={{ padding: tdPad, fontSize: tdFont, color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                                    {formatUnixTimestamp(appt.appointmentStartTime)}<br />
                                                    <span style={{ fontSize: tdFont - 1, color: '#9ca3af', fontWeight: 400 }}>{formatUnixTimestamp(appt.appointmentEndTime)}</span>
                                                </td>
                                            )}
                                            {visibleCols.includes('Aircon') && (
                                                <td style={{ padding: tdPad, fontSize: tdFont, color: '#374151', verticalAlign: 'middle' }}>
                                                    {appt.display?.airconToService || '—'}
                                                </td>
                                            )}
                                            {visibleCols.includes('Feedback') && (
                                                <td style={{ padding: tdPad, fontSize: tdFont, color: '#6b7280', fontStyle: 'italic', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                                    {appt.customerFeedback || 'No feedback'}
                                                </td>
                                            )}
                                            {visibleCols.includes('Technician') && (
                                                <td style={{ padding: tdPad, fontSize: tdFont, color: '#374151', verticalAlign: 'middle' }}>
                                                    {appt.display?.technicianName || 'No technician assigned'}
                                                </td>
                                            )}
                                            {visibleCols.includes('Payment') && (
                                                <td style={{ padding: tdPad, fontSize: tdFont, color: '#374151', verticalAlign: 'middle' }}>
                                                    {appt.display?.paymentMethod || '—'}
                                                </td>
                                            )}
                                            {visibleCols.includes('Status') && (
                                                <td style={{ padding: tdPad, verticalAlign: 'middle' }}>
                                                    <StatusBadge status={appt.display?.appointmentStatus} />
                                                </td>
                                            )}
                                            {visibleCols.includes('Actions') && (
                                                <td style={{ padding: tdPad, verticalAlign: 'middle' }}>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button
                                                            style={{ background: '#4F81BD', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: tdFont, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                                                            onClick={() => navigate('/appointmentDetail?id=' + appt.id)}>
                                                            View
                                                        </button>
                                                        {canCancel && (
                                                            <button
                                                                style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: tdFont, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                                                                onClick={() => handleCancelAppointment(appt.id, appt.appointmentStartTime)}>
                                                                Cancel
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Footer ──────────────────────────────────────────── */}
                    <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f3f4f6', flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ fontSize: 13, color: '#9ca3af' }}>
                            {filtered.length === 0 ? 'No appointments' : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length} appointment${filtered.length !== 1 ? 's' : ''}`}
                        </span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button
                                style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: currentPage <= 1 ? 'default' : 'pointer', opacity: currentPage <= 1 ? 0.5 : 1, fontFamily: 'inherit' }}
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage(p => p - 1)}>← Prev</button>
                            <span style={{ fontSize: 13, color: '#6b7280', padding: '6px 10px' }}>{currentPage} / {totalPages}</span>
                            <button
                                style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: currentPage >= totalPages ? 'default' : 'pointer', opacity: currentPage >= totalPages ? 0.5 : 1, fontFamily: 'inherit' }}
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}>Next →</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;
