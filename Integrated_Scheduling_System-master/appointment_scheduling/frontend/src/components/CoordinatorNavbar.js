import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { logout as serverLogout } from '../axiosConfig';

function CoordinatorNavbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);

    const isCoordinator = !!localStorage.getItem('coordinators_email');

    if (!isCoordinator || !location.pathname.startsWith('/coordinator/')) return null;

    const handleLogout = async () => {
        await serverLogout();
        navigate('/');
    };

    const name = localStorage.getItem('coordinators_name') || 'Coordinator';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const accent = '#4F81BD';

    const navLinks = [
        { to: '/coordinator/home', label: 'Home' },
        { to: '/coordinator/technicianHiring', label: 'Hire Technician' },
        { to: '/coordinator/mailbox', label: 'Mailbox' },
    ];

    const isActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/');

    return (
        <header style={{
            background: 'white',
            borderBottom: '1px solid #e5e7eb',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}>
            <div style={{
                maxWidth: 1280,
                margin: '0 auto',
                padding: '0 20px',
                height: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                {/* Brand */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: accent,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, fontWeight: 700, color: 'white', flexShrink: 0,
                    }}>
                        A
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
                        AirServe
                    </span>
                    <span className="navbar-role-badge" style={{
                        fontSize: 11, fontWeight: 600, color: accent,
                        background: '#EEF4FB', borderRadius: 4, padding: '2px 7px',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: 2,
                    }}>
                        coordinator
                    </span>
                </div>

                {/* Desktop nav links */}
                <nav className="navbar-desktop-links" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {navLinks.map(({ to, label }) => {
                        const active = isActive(to);
                        return (
                            <Link
                                key={to}
                                to={to}
                                style={{
                                    textDecoration: 'none',
                                    fontSize: 14,
                                    fontWeight: active ? 600 : 400,
                                    color: active ? accent : '#6b7280',
                                    padding: '6px 14px',
                                    borderRadius: 8,
                                    background: active ? '#EEF4FB' : 'transparent',
                                    transition: 'all 0.15s',
                                    position: 'relative',
                                }}
                                onMouseEnter={e => {
                                    if (!active) { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.color = '#374151'; }
                                }}
                                onMouseLeave={e => {
                                    if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280'; }
                                }}
                            >
                                {label}
                                {active && (
                                    <span style={{
                                        position: 'absolute', bottom: -14,
                                        left: '50%', transform: 'translateX(-50%)',
                                        width: '60%', height: 2,
                                        background: accent, borderRadius: 2,
                                    }} />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Right side */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: '#EEF4FB',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: accent,
                        border: `1.5px solid #bfdbfe`, flexShrink: 0,
                    }}>
                        {initials}
                    </div>
                    <span className="navbar-name-text" style={{ fontSize: 13, color: '#374151', fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {name}
                    </span>
                    <button
                        onClick={handleLogout}
                        className="navbar-logout-btn"
                        style={{
                            background: 'none', border: '1px solid #e5e7eb',
                            borderRadius: 7, padding: '5px 14px',
                            fontSize: 13, color: '#6b7280', cursor: 'pointer',
                            fontFamily: 'inherit', fontWeight: 500, transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#b91c1c'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
                    >
                        Logout
                    </button>

                    {/* Hamburger — mobile only */}
                    <button
                        className="navbar-hamburger"
                        onClick={() => setMenuOpen(o => !o)}
                        style={{
                            display: 'none',
                            background: 'none', border: '1px solid #e5e7eb',
                            borderRadius: 7, padding: '6px 10px',
                            cursor: 'pointer', fontSize: 18, lineHeight: 1, color: '#374151',
                        }}
                        aria-label="Open menu"
                    >
                        {menuOpen ? '✕' : '☰'}
                    </button>
                </div>
            </div>

            {/* Mobile dropdown menu */}
            {menuOpen && (
                <div style={{
                    borderTop: '1px solid #e5e7eb',
                    background: 'white',
                    padding: '12px 20px 16px',
                }}>
                    {navLinks.map(({ to, label }) => {
                        const active = isActive(to);
                        return (
                            <Link
                                key={to}
                                to={to}
                                onClick={() => setMenuOpen(false)}
                                style={{
                                    display: 'block',
                                    textDecoration: 'none',
                                    fontSize: 15,
                                    fontWeight: active ? 700 : 500,
                                    color: active ? accent : '#374151',
                                    padding: '11px 4px',
                                    borderBottom: '1px solid #f3f4f6',
                                }}
                            >
                                {label}
                            </Link>
                        );
                    })}
                    <button
                        onClick={() => { setMenuOpen(false); handleLogout(); }}
                        style={{
                            marginTop: 10, width: '100%',
                            background: '#fee2e2', color: '#b91c1c',
                            border: 'none', borderRadius: 8,
                            padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                    >
                        Logout
                    </button>
                </div>
            )}
        </header>
    );
}

export default CoordinatorNavbar;
