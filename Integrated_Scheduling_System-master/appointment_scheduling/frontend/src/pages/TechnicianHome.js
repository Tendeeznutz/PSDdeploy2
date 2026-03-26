import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, LayoutList, CalendarRange } from 'lucide-react';
import api from '../axiosConfig';
import gsap from 'gsap';
import TechnicianAvailabilityModal from '../components/TechnicianAvailabilityModal';
import { StatusBadge } from '../components/StatusBadge';

/* ─── Availability toggle ────────────────────────────────────────────────── */
function AvailToggle({ isAvailable, onToggle }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#9ca3af' }}>Off</span>
            <button onClick={onToggle} style={{
                width: 48, height: 26, borderRadius: 9999,
                background: isAvailable ? '#4F81BD' : '#d1d5db',
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'background 0.2s', padding: 0, flexShrink: 0,
            }}>
                <span style={{
                    position: 'absolute', top: 3,
                    left: isAvailable ? 25 : 3,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    transition: 'left 0.2s', display: 'block',
                }} />
            </button>
            <span style={{ fontSize: 13, color: isAvailable ? '#4F81BD' : '#9ca3af', fontWeight: isAvailable ? 600 : 400 }}>
                Available
            </span>
        </div>
    );
}

/* ─── Column toggle dropdown ─────────────────────────────────────────────── */
const TECH_COLUMNS = ['Date/Time', 'Aircon Model/Brand', 'Address', 'Status', 'Actions'];

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
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)', padding: '8px 0', minWidth: 180,
        }}>
            <div style={{ padding: '6px 14px 8px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Columns
            </div>
            {TECH_COLUMNS.map(col => (
                <label key={col}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, color: '#374151' }}
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

/* ─── Calendar view ──────────────────────────────────────────────────────── */
function CalendarView({ appointments, onDayClick, selectedDate }) {
    const [calMonth, setCalMonth] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const isSameDay = (d1, d2) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

    const isToday = (d) => isSameDay(d, new Date());
    const isSelected = (d) => selectedDate && isSameDay(d, selectedDate);

    const apptsByDay = useMemo(() => {
        const map = {};
        appointments.forEach(appt => {
            const d = new Date(appt.appointmentStartTime * 1000);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!map[key]) map[key] = [];
            map[key].push(appt);
        });
        return map;
    }, [appointments]);

    const getDayAppts = (d) => apptsByDay[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`] || [];

    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDOW = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstDOW; i++) {
        cells.push({ day: daysInPrevMonth - firstDOW + 1 + i, other: true, date: new Date(year, month - 1, daysInPrevMonth - firstDOW + 1 + i) });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, other: false, date: new Date(year, month, d) });
    }
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
        cells.push({ day: d, other: true, date: new Date(year, month + 1, d) });
    }

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    const statusColor = (appt) => {
        switch (appt.appointmentStatus) {
            case '2': return '#4F81BD';
            case '3': return '#22c55e';
            case '4': return '#ef4444';
            default: return '#f59e0b';
        }
    };

    return (
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', padding: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>{MONTHS[month]} {year}</h3>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setCalMonth(new Date(year, month - 1, 1))} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                    <button onClick={() => setCalMonth(new Date())} style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>Today</button>
                    <button onClick={() => setCalMonth(new Date(year, month + 1, 1))} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
                {DAYS_SHORT.map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '6px 0' }}>{d}</div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {cells.map((cell, idx) => {
                    const cellAppts = getDayAppts(cell.date);
                    const today = isToday(cell.date);
                    const selected = isSelected(cell.date);
                    return (
                        <div key={idx} onClick={() => !cell.other && onDayClick(cell.date)}
                            style={{ minHeight: 88, borderRadius: 8, padding: '8px 10px', cursor: cell.other ? 'default' : 'pointer', background: selected ? '#EEF4FB' : today ? '#f0f9ff' : 'transparent', border: selected ? '1.5px solid #4F81BD' : today ? '1.5px solid #bae6fd' : '1px solid transparent', transition: 'all 0.15s', opacity: cell.other ? 0.3 : 1 }}
                            onMouseEnter={e => { if (!cell.other && !selected) e.currentTarget.style.background = '#f9fafb'; }}
                            onMouseLeave={e => { if (!cell.other && !selected) e.currentTarget.style.background = 'transparent'; }}
                        >
                            <div style={{ fontSize: 15, fontWeight: today ? 700 : 400, color: today ? '#4F81BD' : '#374151', marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: today ? '#EEF4FB' : 'transparent' }}>
                                {cell.day}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {cellAppts.slice(0, 2).map((appt, i) => (
                                    <div key={i} style={{ fontSize: 11, fontWeight: 500, background: statusColor(appt) + '22', color: statusColor(appt), borderRadius: 4, padding: '2px 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.5 }}>
                                        {new Date(appt.appointmentStartTime * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                    </div>
                                ))}
                                {cellAppts.length > 2 && <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, paddingLeft: 4 }}>+{cellAppts.length - 2} more</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 20, padding: '14px 0 0', borderTop: '1px solid #f3f4f6', flexWrap: 'wrap' }}>
                {[{ color: '#f59e0b', label: 'Pending' }, { color: '#4F81BD', label: 'Upcoming' }, { color: '#22c55e', label: 'Completed' }, { color: '#ef4444', label: 'Cancelled' }].map(({ color, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
                        {label}
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
function TechnicianHome() {
    const navigate = useNavigate();
    const tableContainerRef = useRef(null);

    /* ── Existing state (preserved exactly) ─────────────────────────────── */
    const [appointments, setAppointments] = useState([]);
    const [allJobs, setAllJobs] = useState([]);
    const [addresses, setAddresses] = useState([]);
    const [appointmentStatuses, setAppointmentStatuses] = useState([]);
    const [customerData, setCustomerData] = useState({});
    const [availabilityModalVisible, setAvailabilityModalVisible] = useState(false);

    /* ── UI state ────────────────────────────────────────────────────────── */
    const [isAvailable, setIsAvailable] = useState(true);
    const [selectedDate, setSelectedDate] = useState(null);
    const [activeTab, setActiveTab] = useState('today');

    /* ── Table toolbar state ─────────────────────────────────────────────── */
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [showFilters, setShowFilters] = useState(true);
    const [showColDropdown, setShowColDropdown] = useState(false);
    const [visibleCols, setVisibleCols] = useState([...TECH_COLUMNS]);
    const [density, setDensity] = useState('normal');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const pageSize = 10;

    /* ── Existing handlers (preserved exactly) ───────────────────────────── */
    const openGoogleMaps = (address, postalCode) => {
        const query = encodeURIComponent(`${address} Singapore ${postalCode}`);
        window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    };

    function formatUnixTimestamp(unixTimestamp) {
        const date = new Date(unixTimestamp * 1000);
        return date.toLocaleString('en-US', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    }

    const CompleteJob = (appointmentId) => {
        api.patch(`/api/appointments/${appointmentId}/`, { appointmentStatus: '3' })
            .then(() => {
                setAppointments(prev => prev.map(appt =>
                    appt.id === appointmentId
                        ? {
                            ...appt,
                            appointmentStatus: '3',
                            display: { ...appt.display, appointmentStatus: 'Completed' }
                        }
                        : appt
                ));
                setAllJobs(prev => prev.map(appt =>
                    appt.id === appointmentId
                        ? {
                            ...appt,
                            appointmentStatus: '3',
                            display: { ...appt.display, appointmentStatus: 'Completed' }
                        }
                        : appt
                ));
            })
            .catch(error => { console.error('There was an error!', error); });
    };

    function displayApptStatus(apptStatus) {
        switch (apptStatus) {
            case '1': return 'Pending Admin Action';
            case '2': return 'Upcoming';
            case '3': return 'Completed';
            case '4': return 'Cancelled';
            default: return 'Unknown Status';
        }
    }

    useEffect(() => {
        api.get(`/api/technicians/?technicianId=` + localStorage.getItem('technicians_id'))
            .then(response => {
                const technician = response.data?.[0];
                if (!technician) return;
                localStorage.setItem('technicians_phone', technician.technicianPhone);
                localStorage.setItem('technicians_email', technician.technicianEmail || '');
                localStorage.setItem('technicians_name', technician.technicianName);
                setIsAvailable(technician.technicianStatus === '1');
            })
            .catch(error => { console.error('There was an error!', error); });

        api.get(`/api/appointments/?technicianId=${localStorage.getItem('technicians_id')}`)
            .then(response => {
                setAppointments(response.data);
                setAllJobs(response.data);
                const uniqueCustomerIds = [...new Set(response.data.map(appt => appt.customerId))];
                const customerDataMap = {};
                Promise.all(
                    uniqueCustomerIds.map(customerId =>
                        api.get(`/api/customers/${customerId}/`)
                            .then(r => {
                                customerDataMap[customerId] = {
                                    address: r.data.customerAddress,
                                    postalCode: r.data.customerPostalCode,
                                    name: r.data.customerName,
                                    phone: r.data.customerPhone,
                                    email: r.data.customerEmail,
                                };
                            })
                            .catch(err => { console.error('Error fetching customer details:', err); })
                    )
                ).then(() => {
                    setCustomerData(customerDataMap);
                    if (response.data.length > 0) {
                        const firstCustomerId = response.data[0].customerId;
                        if (customerDataMap[firstCustomerId]) {
                            setAddresses(customerDataMap[firstCustomerId].address);
                        }
                    }
                });
            })
            .catch(error => { console.error('Error fetching appointments:', error); });
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            const hero = document.querySelectorAll('.tech-hero');
            if (hero.length > 0) {
                gsap.from(hero, { opacity: 0, y: 20, duration: 0.4, ease: 'power2.out' });
            }
        }, 50);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (activeTab === 'alljobs') {
            const timer = setTimeout(() => {
                const statChips = document.querySelectorAll('.alljobs-stats .stat-chip');
                const allJobRows = document.querySelectorAll('.alljobs-row');
                if (statChips.length > 0) {
                    gsap.from(statChips, {
                        opacity: 0, y: 8, stagger: 0.06, duration: 0.3, ease: 'power2.out'
                    });
                }
                if (allJobRows.length > 0) {
                    gsap.from(allJobRows, {
                        opacity: 0, y: 6, stagger: 0.03, duration: 0.25, ease: 'power2.out'
                    });
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [activeTab, allJobs]);

    /* ── Fullscreen ──────────────────────────────────────────────────────── */
    const toggleFullscreen = () => {
        if (!isFullscreen) tableContainerRef.current?.requestFullscreen?.();
        else document.exitFullscreen?.();
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

    const handleTabChange = (tab) => {
        if (tab === activeTab) return;
        const content = document.querySelector('.tab-content-area');
        if (!content) {
            setActiveTab(tab);
            setCurrentPage(1);
            return;
        }
        gsap.to(content, {
            opacity: 0,
            y: 6,
            duration: 0.15,
            ease: 'power2.in',
            onComplete: () => {
                setActiveTab(tab);
                setCurrentPage(1);
                requestAnimationFrame(() => {
                    const nextContent = document.querySelector('.tab-content-area');
                    if (nextContent) {
                        gsap.fromTo(nextContent,
                            { opacity: 0, y: 6 },
                            { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }
                        );
                    }
                });
            }
        });
    };

    /* ── Derived values ──────────────────────────────────────────────────── */
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const techName = localStorage.getItem('technicians_name') || 'Technician';

    const dateStrip = useMemo(() => {
        const days = [];
        const now = new Date();
        for (let i = 0; i < 14; i++) {
            const d = new Date(now);
            d.setDate(now.getDate() + i);
            days.push(d);
        }
        return days;
    }, []);

    const isSameDay = (d1, d2) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

    const selectedDay = useMemo(() => selectedDate || new Date(), [selectedDate]);

    const todayJobCount = useMemo(() => {
        const today = new Date();
        return appointments.filter(appt => isSameDay(new Date(appt.appointmentStartTime * 1000), today)).length;
    }, [appointments]);

    /* ── Filter + search for the selected day ────────────────────────────── */
    const jobsForDay = useMemo(() => {
        return appointments.filter(appt => {
            const d = new Date(appt.appointmentStartTime * 1000);
            return isSameDay(d, selectedDay);
        });
    }, [appointments, selectedDay]);

    const filteredTodayJobs = useMemo(() => {
        return jobsForDay.filter(appt => {
            const statusLabel = displayApptStatus(appt.appointmentStatus);
            const matchStatus = statusFilter === 'All' || statusLabel === statusFilter;
            const q = search.toLowerCase();
            const customer = customerData[appt.customerId];
            const matchSearch = !q ||
                formatUnixTimestamp(appt.appointmentStartTime).toLowerCase().includes(q) ||
                (Array.isArray(appt.display?.airconBrand) ? appt.display.airconBrand.join(', ') : (appt.display?.airconBrand || '')).toLowerCase().includes(q) ||
                (customer ? `${customer.address} S${customer.postalCode}` : '').toLowerCase().includes(q) ||
                statusLabel.toLowerCase().includes(q);
            return matchStatus && matchSearch;
        });
    }, [jobsForDay, search, statusFilter, customerData]);

    const getAppointmentDateValue = (job) => {
        if (job.appointmentDate) return job.appointmentDate;
        if (job.startTime) return job.startTime;
        if (job.appointmentStartTime) return job.appointmentStartTime * 1000;
        return Date.now();
    };

    const sortedAllJobs = useMemo(() => {
        return [...allJobs].sort((a, b) => new Date(getAppointmentDateValue(a)) - new Date(getAppointmentDateValue(b)));
    }, [allJobs]);

    const filteredAllJobs = useMemo(() => {
        return sortedAllJobs.filter(job => {
            const customer = customerData[job.customerId];
            const statusLabel = displayApptStatus(job.appointmentStatus);
            const matchStatus = statusFilter === 'All' || statusLabel === statusFilter;
            const q = search.toLowerCase();
            const airconBrand = Array.isArray(job.display?.airconBrand) ? job.display.airconBrand.join(', ') : (job.display?.airconBrand || '');
            const airconModel = Array.isArray(job.display?.airconModel) ? job.display.airconModel.join(', ') : (job.display?.airconModel || '');
            const matchSearch = !q ||
                (customer?.name || '').toLowerCase().includes(q) ||
                `${customer?.address || ''} ${customer?.postalCode || ''}`.toLowerCase().includes(q) ||
                airconBrand.toLowerCase().includes(q) ||
                airconModel.toLowerCase().includes(q) ||
                statusLabel.toLowerCase().includes(q);
            return matchStatus && matchSearch;
        });
    }, [sortedAllJobs, customerData, search, statusFilter]);

    const currentTableRows = activeTab === 'alljobs' ? filteredAllJobs : filteredTodayJobs;
    const totalPages = Math.max(1, Math.ceil(currentTableRows.length / pageSize));
    const paginated = currentTableRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const rangeStart = currentTableRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const rangeEnd = Math.min(currentPage * pageSize, currentTableRows.length);

    useEffect(() => {
        if (activeTab !== 'today' || paginated.length === 0) return;
        const timer = setTimeout(() => {
            const rows = document.querySelectorAll('.appt-row-tech');
            if (rows.length > 0) {
                gsap.from(rows, { opacity: 0, y: 8, stagger: 0.04, duration: 0.3, ease: 'power2.out', delay: 0.1 });
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [activeTab, paginated]);

    const STATUS_FILTERS = ['All', 'Pending Admin Action', 'Upcoming', 'Completed', 'Cancelled'];
    const DENSITY_OPTS = [{ key: 'compact', label: 'Compact' }, { key: 'normal', label: 'Normal' }, { key: 'comfortable', label: 'Comfortable' }];
    const densityPad = { compact: '9px 14px', normal: '14px 16px', comfortable: '19px 16px' };
    const densityFont = { compact: 13, normal: 14, comfortable: 15 };
    const tdPad = densityPad[density];
    const tdFont = densityFont[density];

    const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const iconBtn = (active) => ({
        background: active ? '#EEF4FB' : 'white',
        border: '1px solid ' + (active ? '#4F81BD' : '#e5e7eb'),
        borderRadius: 8, padding: '7px 11px', fontSize: 13,
        cursor: 'pointer', fontFamily: 'inherit', color: active ? '#4F81BD' : '#374151',
        display: 'flex', alignItems: 'center', gap: 5, fontWeight: active ? 600 : 400,
        whiteSpace: 'nowrap',
    });

    const tabBtn = (active) => ({
        background: active ? 'white' : 'transparent',
        color: active ? '#0f172a' : '#6b7280',
        fontWeight: active ? 600 : 400,
        borderRadius: 7,
        padding: '6px 14px',
        fontSize: 13,
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        transition: 'all 0.15s ease',
        fontFamily: 'inherit',
    });

    const sectionTitle = activeTab === 'today'
        ? "Today's Appointments"
        : activeTab === 'alljobs'
            ? 'All Jobs'
            : 'Calendar';

    const allJobsStats = useMemo(() => {
        const getStatus = (job) => displayApptStatus(job.appointmentStatus).toLowerCase();
        return {
            total: allJobs.length,
            upcoming: allJobs.filter(job => {
                const status = getStatus(job);
                return status.includes('upcoming') || status.includes('confirmed');
            }).length,
            completed: allJobs.filter(job => getStatus(job).includes('completed')).length,
            pending: allJobs.filter(job => getStatus(job).includes('pending')).length,
        };
    }, [allJobs]);

    const renderActions = (appt) => {
        const customer = customerData[appt.customerId];
        return (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                    style={{ background: '#4F81BD', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: tdFont, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                    onClick={() => { window.location.href = '/technician/appointmentDetail?id=' + appt.id; }}>
                    View
                </button>
                {customer && (
                    <button
                        style={{ background: '#EEF4FB', color: '#4F81BD', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: tdFont, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                        onClick={() => openGoogleMaps(customer.address, customer.postalCode)}>
                        📍 Map
                    </button>
                )}
                {appt.appointmentStatus === '2' && (
                    <button
                        style={{ background: '#dcfce7', color: '#15803d', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: tdFont, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                        onClick={() => CompleteJob(appt.id)}>
                        ✓ Complete
                    </button>
                )}
            </div>
        );
    };

    return (
        <div style={{ background: '#fafafa', minHeight: '100vh', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <div className="tech-hero dash-hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '28px 40px', background: 'white', borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <p style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', margin: 0 }}>
                        {greeting}, {techName}
                    </p>
                    <p style={{ fontSize: 15, color: '#6b7280', marginTop: 6, margin: '6px 0 0' }}>
                        You have <strong style={{ color: '#0f172a' }}>{todayJobCount}</strong> job{todayJobCount !== 1 ? 's' : ''} today
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <AvailToggle isAvailable={isAvailable} onToggle={() => setIsAvailable(v => !v)} />
                    <div style={{ width: 1, height: 24, background: '#e5e7eb' }} />
                    <button
                        style={{ background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}
                        onClick={() => setAvailabilityModalVisible(true)}>📅 Set Working Days</button>
                    <button
                        style={{ background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}
                        onClick={() => navigate('/technician/mailbox')}>✉ Mailbox</button>
                </div>
            </div>

            {/* ── Date strip ─────────────────────────────────────────────────── */}
            {activeTab !== 'calendar' && (
                <div className="dash-date-strip" style={{ background: 'white', borderBottom: '1px solid #f3f4f6', padding: '0 40px' }}>
                    <div style={{ overflowX: 'auto', display: 'flex', gap: 8, padding: '12px 0' }}>
                        {dateStrip.map((d, i) => {
                            const active = isSameDay(d, selectedDay);
                            return (
                                <button key={i}
                                    style={active
                                        ? { background: '#4F81BD', color: 'white', borderRadius: 9999, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', whiteSpace: 'nowrap', fontFamily: 'inherit' }
                                        : { background: '#f3f4f6', color: '#6b7280', borderRadius: 9999, padding: '7px 16px', fontSize: 13, cursor: 'pointer', border: 'none', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
                                    onClick={() => { setSelectedDate(d); setCurrentPage(1); }}>
                                    {SHORT_DAYS[d.getDay()]} {d.getDate()}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Main section ─────────────────────────────────────────────── */}
            <div className="dash-section" style={{ padding: '28px 40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                        {sectionTitle}
                    </h2>
                    <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 10, padding: 4, gap: 2 }}>
                        <button style={tabBtn(activeTab === 'today')} onClick={() => handleTabChange('today')}>
                            <CalendarDays size={13} />
                            Today
                        </button>
                        <button style={tabBtn(activeTab === 'alljobs')} onClick={() => handleTabChange('alljobs')}>
                            <LayoutList size={13} />
                            All Jobs
                        </button>
                        <button style={tabBtn(activeTab === 'calendar')} onClick={() => handleTabChange('calendar')}>
                            <CalendarRange size={13} />
                            Calendar
                        </button>
                    </div>
                </div>

                {activeTab === 'alljobs' && (
                    <div className="alljobs-stats" style={{ display: 'flex', gap: 16, padding: '12px 0 0 0', flexWrap: 'wrap', marginBottom: 18 }}>
                        {[
                            { label: 'Total Jobs', count: allJobsStats.total },
                            { label: 'Upcoming', count: allJobsStats.upcoming },
                            { label: 'Completed', count: allJobsStats.completed },
                            { label: 'Pending', count: allJobsStats.pending },
                        ].map(stat => (
                            <div key={stat.label} className="stat-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 14px', fontSize: 12, color: '#374151' }}>
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>{stat.count}</span>
                                <span style={{ color: '#6b7280' }}>{stat.label}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="tab-content-area">
                {/* ── Calendar ───────────────────────────────────────────────── */}
                {activeTab === 'calendar' && (
                    <CalendarView
                        appointments={appointments}
                        selectedDate={selectedDate}
                        onDayClick={(d) => { setSelectedDate(d); handleTabChange('today'); }}
                    />
                )}

                {/* ── Table view ─────────────────────────────────────────────── */}
                {(activeTab === 'today' || activeTab === 'alljobs') && (
                    <div ref={tableContainerRef} style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

                        {/* Toolbar */}
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

                            <div style={{ width: 1, height: 28, background: '#e5e7eb' }} />

                            {/* Filter toggle */}
                            <button style={iconBtn(showFilters)} onClick={() => setShowFilters(v => !v)}>⚙ Filter</button>

                            {/* Columns dropdown */}
                            <div style={{ position: 'relative' }}>
                                <button style={iconBtn(showColDropdown)} onClick={() => setShowColDropdown(v => !v)}>⬜ Columns</button>
                                {showColDropdown && (
                                    <ColumnDropdown visibleCols={visibleCols} onToggle={toggleCol} onClose={() => setShowColDropdown(false)} />
                                )}
                            </div>

                            {/* Density */}
                            <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3, gap: 2 }}>
                                {DENSITY_OPTS.map(d => (
                                    <button key={d.key}
                                        style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: density === d.key ? 600 : 400, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: density === d.key ? 'white' : 'transparent', color: density === d.key ? '#0f172a' : '#6b7280', boxShadow: density === d.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}
                                        onClick={() => setDensity(d.key)}>
                                        {d.label}
                                    </button>
                                ))}
                            </div>

                            {/* Fullscreen */}
                            <button style={iconBtn(isFullscreen)} onClick={toggleFullscreen}>
                                {isFullscreen ? '⤡ Exit' : '⤢ Fullscreen'}
                            </button>
                        </div>

                        {/* Filter pills */}
                        {showFilters && (
                            <div style={{ padding: '10px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, marginRight: 4 }}>STATUS</span>
                                {STATUS_FILTERS.map(f => (
                                    <button key={f}
                                        style={{ borderRadius: 9999, padding: '5px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit', background: statusFilter === f ? '#4F81BD' : '#f3f4f6', color: statusFilter === f ? 'white' : '#6b7280', transition: 'all 0.15s' }}
                                        onClick={() => { setStatusFilter(f); setCurrentPage(1); }}>
                                        {f}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Table */}
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                                        {activeTab === 'alljobs' && <th style={{ padding: '11px 16px', fontSize: 11, fontWeight: 600, color: '#6b7280', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Date</th>}
                                        {visibleCols.includes('Date/Time') && <th style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Appointment Date/Time</th>}
                                        {visibleCols.includes('Aircon Model/Brand') && <th style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Aircon Model/Brand</th>}
                                        {visibleCols.includes('Address') && <th style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Address</th>}
                                        {visibleCols.includes('Status') && <th style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Status</th>}
                                        {visibleCols.includes('Actions') && <th style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.length === 0 ? (
                                        <tr>
                                            <td colSpan={visibleCols.length + (activeTab === 'alljobs' ? 1 : 0)} style={{ padding: activeTab === 'alljobs' ? '40px 0' : '48px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                                                {activeTab === 'alljobs'
                                                    ? (allJobs.length === 0 ? 'No jobs assigned yet.' : 'No results match your search.')
                                                    : (filteredTodayJobs.length === 0 && jobsForDay.length > 0 ? 'No results match your search.' : 'No appointments scheduled for this day.')}
                                            </td>
                                        </tr>
                                    ) : paginated.map((appt, index) => {
                                        const customer = customerData[appt.customerId];
                                        const statusLabel = displayApptStatus(appt.appointmentStatus);
                                        const airconBrand = Array.isArray(appt.display?.airconBrand) ? appt.display.airconBrand.join(', ') : (appt.display?.airconBrand || '—');
                                        const airconModel = Array.isArray(appt.display?.airconModel) ? appt.display.airconModel.join(', ') : (appt.display?.airconModel || '');
                                        const currentDate = new Date(getAppointmentDateValue(appt));
                                        const currentDateKey = currentDate.toDateString();
                                        const previousDateKey = index > 0 ? new Date(getAppointmentDateValue(paginated[index - 1])).toDateString() : null;
                                        const showGroupHeader = activeTab === 'alljobs' && currentDateKey !== previousDateKey;

                                        return (
                                            <React.Fragment key={appt.id}>
                                                {showGroupHeader && (
                                                    <tr>
                                                        <td colSpan={visibleCols.length + 1} style={{ padding: '8px 16px', background: '#f9fafb', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', borderTop: '2px solid #f3f4f6' }}>
                                                            {currentDate.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                                        </td>
                                                    </tr>
                                                )}
                                                <tr className={activeTab === 'alljobs' ? 'alljobs-row' : 'appt-row-tech'}
                                                    style={{ borderBottom: '1px solid #f9fafb' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                                                    {activeTab === 'alljobs' && (
                                                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap', fontWeight: 500, verticalAlign: 'middle' }}>
                                                            {currentDate.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                        </td>
                                                    )}

                                                    {visibleCols.includes('Date/Time') && (
                                                        <td style={{ padding: tdPad, fontSize: tdFont, color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                                            {formatUnixTimestamp(appt.appointmentStartTime)}<br />
                                                            <span style={{ fontSize: tdFont - 1, color: '#9ca3af', fontWeight: 400 }}>
                                                                {formatUnixTimestamp(appt.appointmentEndTime)}
                                                            </span>
                                                        </td>
                                                    )}

                                                    {visibleCols.includes('Aircon Model/Brand') && (
                                                        <td style={{ padding: tdPad, fontSize: tdFont, color: '#374151', verticalAlign: 'middle' }}>
                                                            <span style={{ fontWeight: 500 }}>{airconBrand}</span>
                                                            {airconModel && <span style={{ display: 'block', fontSize: tdFont - 1, color: '#9ca3af', marginTop: 2 }}>{airconModel}</span>}
                                                        </td>
                                                    )}

                                                    {visibleCols.includes('Address') && (
                                                        <td style={{ padding: tdPad, fontSize: tdFont, color: '#374151', verticalAlign: 'middle' }}>
                                                            {customer ? `${customer.address} S${customer.postalCode}` : <span style={{ color: '#9ca3af' }}>Loading…</span>}
                                                        </td>
                                                    )}

                                                    {visibleCols.includes('Status') && (
                                                        <td style={{ padding: tdPad, verticalAlign: 'middle' }}>
                                                            <StatusBadge status={statusLabel} />
                                                        </td>
                                                    )}

                                                    {visibleCols.includes('Actions') && (
                                                        <td style={{ padding: tdPad, verticalAlign: 'middle' }}>
                                                            {renderActions(appt)}
                                                        </td>
                                                    )}
                                                </tr>
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f3f4f6', flexWrap: 'wrap', gap: 8 }}>
                            <span style={{ fontSize: 13, color: '#9ca3af' }}>
                                {currentTableRows.length === 0 ? 'No appointments' : `Showing ${rangeStart}–${rangeEnd} of ${currentTableRows.length} appointment${currentTableRows.length !== 1 ? 's' : ''}`}
                            </span>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <button
                                    style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: currentPage <= 1 ? 'default' : 'pointer', opacity: currentPage <= 1 ? 0.5 : 1, fontFamily: 'inherit' }}
                                    disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>← Prev</button>
                                <span style={{ fontSize: 13, color: '#6b7280', padding: '6px 10px' }}>{currentPage} / {totalPages}</span>
                                <button
                                    style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: currentPage >= totalPages ? 'default' : 'pointer', opacity: currentPage >= totalPages ? 0.5 : 1, fontFamily: 'inherit' }}
                                    disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next →</button>
                            </div>
                        </div>
                    </div>
                )}
                </div>
            </div>

            {/* Weekly working days modal (untouched) */}
            <TechnicianAvailabilityModal
                visible={availabilityModalVisible}
                onClose={() => setAvailabilityModalVisible(false)}
                technicianId={localStorage.getItem('technicians_id')}
            />
        </div>
    );
}

export default TechnicianHome;
