import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserRound, Wrench, ClipboardList, Calendar } from 'lucide-react';
import api, { clearSessionData } from '../axiosConfig';
import { BackgroundPaths } from '../components/BackgroundPaths';

const ROLES = [
  { id: 'customer', label: 'Customer', description: 'Book and manage your appointments', icon: '👤' },
  { id: 'technician', label: 'Technician', description: 'View jobs and update availability', icon: '🔧' },
  { id: 'coordinator', label: 'Coordinator', description: 'Manage appointments and technicians', icon: '📋' },
];

/* ─── Auth redirect ──────────────────────────────────────────────────────── */
function useAuthRedirect(navigate) {
  useEffect(() => {
    if (localStorage.getItem('customers_id'))   { navigate('/customer/home');    return; }
    if (localStorage.getItem('technicians_id')) { navigate('/technician/home');  return; }
    if (localStorage.getItem('coordinators_id')){ navigate('/coordinator/home'); return; }
  }, [navigate]);
}

/* ─── Animated heading letters ───────────────────────────────────────────── */
function AnimatedHeading() {
  const word = 'AirServe';
  return (
    <div style={{ display: 'inline-block' }}>
      {word.split('').map((letter, i) => (
        <motion.span
          key={i}
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: i * 0.05, type: 'spring', stiffness: 150, damping: 25 }}
          style={{
            display: 'inline-block',
            fontSize: 'clamp(52px, 9vw, 96px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: '#0f172a',
          }}
        >
          {letter}
        </motion.span>
      ))}
    </div>
  );
}

/* ─── Booking preview card ───────────────────────────────────────────────── */
function BookingCard() {
  const row = (label, value) => (
    <div style={{ padding: '14px 20px', borderTop: '1px solid #f3f4f6' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#9ca3af', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1f2937' }}>{value}</div>
    </div>
  );
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: 'white',
        borderRadius: 20,
        boxShadow: '0 24px 80px rgba(0,0,0,0.16)',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        width: '100%',
        maxWidth: 340,
      }}
    >
      <div style={{ padding: '20px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#9ca3af', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Next Available</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Today, 4:30 PM</div>
        </div>
        <div style={{ width: 36, height: 36, background: '#eff6ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Calendar size={18} color="#2563eb" />
        </div>
      </div>
      {row('Aircon Profile', '3 units · HDB · overdue 6 months')}
      {row('Assigned Crew', 'Zenith Cooling · 12 mins away')}
      {row('Service Promise', 'Checklist photos + 30-day warranty')}
      <div style={{ background: '#0f172a', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Estimated Total</div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>Before approval</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginTop: 4 }}>$180 – $220</div>
      </div>
    </motion.div>
  );
}

/* ─── Role card ──────────────────────────────────────────────────────────── */
const ROLE_CONFIG = [
  { id: 'customer',    label: 'Customer',    description: 'Book appointments, track service, manage your aircon profile.',          Icon: UserRound   },
  { id: 'technician',  label: 'Technician',  description: 'View assigned jobs, set your availability, update statuses.',           Icon: Wrench      },
  { id: 'coordinator', label: 'Coordinator', description: 'Manage all appointments, hire technicians, oversee operations.',        Icon: ClipboardList },
];

/* ─── Landing page data ───────────────────────────────────────────────────── */
const steps = [
  { title: 'Tell us what you need', description: 'Pick the service type and share your unit details.' },
  { title: 'Choose a time window', description: 'Live availability shows slots across the island.' },
  { title: 'Track your technician', description: 'Get real-time updates, arrival ETA, and service photos.' },
];

const testimonials = [
  { name: 'Chen Wei', quote: 'Booked at lunch, serviced by evening. The air is crisp again.', rating: 5 },
  { name: 'Aisha Rahman', quote: 'Loved the checklist and photos. Everything felt professional.', rating: 5 },
];

const faqs = [
  { question: 'How do I book an appointment?', answer: 'Sign in as a Customer, then click "Book" in your dashboard and follow the steps.' },
  { question: 'What areas do you cover?', answer: 'We serve all areas in Singapore, with technicians routed based on availability and proximity.' },
  { question: 'How much does servicing cost?', answer: 'General servicing starts at $50 per unit, plus a $10 travel fee. Chemical wash is $80 per unit.' },
  { question: 'Do you provide warranty?', answer: 'Yes. Every visit includes a 30-day warranty. We will revisit free of charge if something feels off.' },
  { question: 'What payment methods are accepted?', answer: 'We accept cash, card, PayLah/PayNow, bank transfer, and cheques. Payment is collected after service.' },
];

/* ─── FAQ accordion item ─────────────────────────────────────────────────── */
function FAQItem({ faq }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(v => !v)}
      style={{
        borderRadius: 16, border: '1px solid #e5e7eb',
        background: open ? 'white' : '#f9fafb',
        padding: '20px 24px', cursor: 'pointer',
        boxShadow: open ? '0 2px 12px rgba(0,0,0,0.06)' : 'none',
        transition: 'background 0.2s, box-shadow 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', lineHeight: 1.4 }}>{faq.question}</span>
        <span style={{
          fontSize: 22, color: '#2563eb', flexShrink: 0, lineHeight: 1,
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          transition: 'transform 0.25s ease',
          display: 'inline-block',
        }}>+</span>
      </div>
      {open && (
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 12, lineHeight: 1.65, marginBottom: 0 }}>
          {faq.answer}
        </p>
      )}
    </div>
  );
}

function RoleCard({ role, index, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.1, duration: 0.5 }}
      whileHover={{ y: -6 }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white',
        border: `1.5px solid ${hovered ? '#2563eb' : '#e5e7eb'}`,
        borderRadius: 16,
        padding: '32px 28px',
        cursor: 'pointer',
        boxShadow: hovered ? '0 16px 40px rgba(0,0,0,0.10)' : '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      <div style={{ width: 44, height: 44, background: '#eff6ff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <role.Icon size={22} color="#2563eb" />
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginTop: 16 }}>{role.label}</div>
      <div style={{ fontSize: 14, color: '#6b7280', marginTop: 8, lineHeight: 1.5 }}>{role.description}</div>
      <div style={{ fontSize: 14, color: '#2563eb', fontWeight: 600, marginTop: 20 }}>Sign in →</div>
    </motion.div>
  );
}

/* ─── Forgot password dialog ─────────────────────────────────────────────── */
function ForgotPasswordDialog({ role, onClose }) {
  const isPhone = role === 'technician';
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      let endpoint, payload;
      if (isPhone) {
        endpoint = '/api/technicians/forgot-password/';
        payload = { phone: value };
      } else {
        endpoint = '/api/customers/forgot-password/';
        payload = { email: value };
      }
      const response = await api.post(endpoint, payload);
      setMessage(response.data.message || 'If an account exists, a reset link has been sent.');
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Coordinators don't have self-service password reset
  if (role === 'coordinator') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
        <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 25px 50px rgba(0,0,0,0.15)', width: '100%', maxWidth: 420, margin: '0 16px', padding: 24 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Reset Password</div>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
          </div>
          <div style={{ padding: 16, background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: '#374151', margin: 0 }}>Coordinator password resets must be performed by another coordinator from the admin panel.</p>
          </div>
          <button onClick={onClose} style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Back to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 25px 50px rgba(0,0,0,0.15)', width: '100%', maxWidth: 420, margin: '0 16px', padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Reset Password</div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit}>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
              {isPhone
                ? "Enter your phone number and we'll send a reset link to your registered email."
                : "Enter your email address and we'll send you a password reset link."}
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block' }}>
                {isPhone ? 'Phone Number' : 'Email'} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type={isPhone ? 'tel' : 'email'}
                placeholder={isPhone ? 'e.g. 91234567' : 'name@mail.com'}
                style={{ width: '100%', padding: '10px 14px', fontSize: 15, color: '#0f172a', background: 'white', border: '1.5px solid #d1d5db', borderRadius: 10, outline: 'none', boxSizing: 'border-box', marginTop: 8, fontFamily: 'inherit' }}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                {...(isPhone ? { pattern: '[0-9]{8}', title: 'Phone number must be 8 digits' } : {})}
                autoFocus
              />
            </div>
            {error && <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={onClose} style={{ flex: 1, background: 'white', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: 10, padding: '12px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button type="submit" disabled={loading} style={{ flex: 1, background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>{loading ? 'Sending...' : 'Send Reset Link'}</button>
            </div>
          </form>
        ) : (
          <div>
            <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0', marginBottom: 16 }}>
              <p style={{ fontSize: 14, color: '#15803d', margin: '0 0 8px' }}>{message}</p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Please check your email for the password reset link.</p>
            </div>
            <button onClick={onClose} style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Back to Login</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Login form (role selected) ─────────────────────────────────────────── */
function LoginForm({ selectedRole, emailOrPhone, setEmailOrPhone, password, setPassword, errorMessage, handleSubmit, handleBackToRoleSelect, showForgotPassword, setShowForgotPassword }) {
  const isPhoneRole = selectedRole === 'technician';
  const inputLabel = isPhoneRole ? 'Phone' : 'Email';
  const inputPlaceholder = isPhoneRole ? 'e.g. 91234567' : 'name@mail.com';
  const inputType = isPhoneRole ? 'tel' : 'email';

  const inputStyle = {
    width: '100%', padding: '10px 14px', fontSize: 15, color: '#0f172a',
    background: 'white', border: '1.5px solid #d1d5db', borderRadius: 10,
    outline: 'none', boxSizing: 'border-box', marginTop: 8, fontFamily: 'inherit',
  };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block' };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ background: 'white', borderRadius: 20, padding: '40px 36px', width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}
      >
        <button type="button" onClick={handleBackToRoleSelect}
          style={{ fontSize: 13, color: '#2563eb', cursor: 'pointer', background: 'none', border: 'none', padding: 0, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
          ← Back
        </button>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.15em', color: '#2563eb', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>Portal Access</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Sign in as {ROLES.find(r => r.id === selectedRole)?.label}
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{inputLabel} <span style={{ color: '#ef4444' }}>*</span></label>
            <input id="loginId" type={inputType} placeholder={inputPlaceholder} style={inputStyle}
              value={emailOrPhone} onChange={(e) => setEmailOrPhone(e.target.value)} required aria-label={inputLabel} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>Password <span style={{ color: '#ef4444' }}>*</span></label>
            <input type="password" placeholder="••••••••" style={inputStyle}
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {errorMessage && <p style={{ fontSize: 13, color: '#ef4444', fontStyle: 'italic', margin: '8px 0' }}>{errorMessage}</p>}
          <motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: '13px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 16, fontFamily: 'inherit' }}>
            Sign in as {ROLES.find(r => r.id === selectedRole)?.label}
          </motion.button>
        </form>
        {/* Forgot Password link — shown for all roles */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button type="button" onClick={() => setShowForgotPassword(true)}
            style={{ fontSize: 13, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
            Forgot Password?
          </button>
        </div>
        {selectedRole === 'customer' && (
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#6b7280' }}>
              Not registered?{' '}
              <Link to="/register" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Create account</Link>
            </p>
            <div style={{ marginTop: 16, padding: '14px 16px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe' }}>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 10 }}>Need a one-time service without an account?</p>
              <Link to="/guest-booking" style={{ display: 'block' }}>
                <button style={{ width: '100%', background: 'white', color: '#2563eb', border: '1.5px solid #2563eb', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Quick Booking (No Account Required)
                </button>
              </Link>
            </div>
          </div>
        )}
        {selectedRole === 'technician' && (
          <div style={{ marginTop: 8, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 10 }}>
              Want to join as a technician?{' '}
              <Link to="/apply-technician" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Apply here</Link>
            </p>
          </div>
        )}
      </motion.div>
      {/* Forgot Password Dialog */}
      {showForgotPassword && (
        <ForgotPasswordDialog
          role={selectedRole}
          onClose={() => setShowForgotPassword(false)}
        />
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
function Login() {
  const location = useLocation();
  const pathRole = location.pathname.replace(/^\/login\/?/, '') || null;
  const roleFromPath = ['customer', 'technician', 'coordinator'].includes(pathRole) ? pathRole : null;
  const [selectedRole, setSelectedRole] = useState(roleFromPath);
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const navigate = useNavigate();

  useAuthRedirect(navigate);

  useEffect(() => {
    if (roleFromPath !== selectedRole) setSelectedRole(roleFromPath);
  }, [roleFromPath]);


  const handleRoleSelect = (roleId) => {
    setEmailOrPhone(''); setPassword(''); setErrorMessage('');
    navigate(`/login/${roleId}`);
  };
  const handleBackToRoleSelect = () => {
    setEmailOrPhone(''); setPassword(''); setErrorMessage('');
    navigate('/login');
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    const roleToEndpoint = { customer: 'customers', technician: 'technicians', coordinator: 'coordinators' };
    const endpoint = `/api/${roleToEndpoint[selectedRole]}/login/`;
    try {
      // Clear previous session data before login
      clearSessionData();
      const response = await api.post(endpoint, { email: emailOrPhone, password });
      if (response.status === 200) {
        // JWT tokens are set as HTTP-only cookies by the server.
        // Only store non-sensitive user info for UI display.
        if (selectedRole === 'customer') {
          localStorage.setItem('customers_id', response.data.customer_id);
          localStorage.setItem('customers_name', response.data.customerName);
          navigate('/customer/home');
        } else if (selectedRole === 'technician') {
          localStorage.setItem('technicians_phone', response.data.technician_phone);
          localStorage.setItem('technicians_id', response.data.technician_id);
          localStorage.setItem('technicians_name', response.data.technicianName);
          navigate('/technician/home');
        } else {
          localStorage.setItem('coordinators_id', response.data.coordinator_id);
          localStorage.setItem('coordinators_email', response.data.coordinatorEmail);
          localStorage.setItem('coordinators_name', response.data.coordinatorName);
          navigate('/coordinator/home');
        }
      }
    } catch (error) {
      if (!error.response) {
        // No response at all — network error or backend cold start timeout
        setErrorMessage('Server is starting up. Please wait a moment and try again.');
      } else if (error.response.status >= 500) {
        setErrorMessage('Server is temporarily unavailable. Please try again in a moment.');
      } else {
        const msg = error.response?.data?.error || error.response?.data?.detail || 'Login failed. Please try again.';
        setErrorMessage(typeof msg === 'string' ? msg : 'Login failed. Please try again.');
      }
    }
  };

  if (selectedRole) {
    return (
      <LoginForm
        selectedRole={selectedRole}
        emailOrPhone={emailOrPhone} setEmailOrPhone={setEmailOrPhone}
        password={password} setPassword={setPassword}
        errorMessage={errorMessage}
        handleSubmit={handleSubmit}
        handleBackToRoleSelect={handleBackToRoleSelect}
        showForgotPassword={showForgotPassword}
        setShowForgotPassword={setShowForgotPassword}
      />
    );
  }

  /* ── HOME SCREEN ─────────────────────────────────────────────────────────── */
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: '#ffffff' }}>

      {/* ── HERO: BackgroundPaths fills the entire section ───────────────────── */}
      <BackgroundPaths>
        {/* Gradient color blobs */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
          <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '45%', height: '80%', background: 'radial-gradient(ellipse, rgba(59,130,246,0.16) 0%, transparent 70%)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', top: '-15%', right: '-5%', width: '40%', height: '70%', background: 'radial-gradient(ellipse, rgba(251,146,60,0.15) 0%, transparent 70%)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: '-10%', left: '30%', width: '40%', height: '50%', background: 'radial-gradient(ellipse, rgba(147,197,253,0.12) 0%, transparent 70%)', borderRadius: '50%' }} />
        </div>

        {/* Hero content */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          {/* Minimal nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px', maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>AirServe</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/guest-booking')}
                style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Book a visit
              </motion.button>
            </div>
          </div>

          {/* Eyebrow + animated title — centered, full width */}
          <div style={{ textAlign: 'center', padding: '40px 24px 20px' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.15em', color: '#6b7280', fontWeight: 600, marginBottom: 16, textTransform: 'uppercase' }}>
              Airserve
            </div>
            <AnimatedHeading />
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              style={{ fontSize: 16, color: '#6b7280', marginTop: 12, marginBottom: 0 }}
            >
              Book premium aircon care with trusted technicians.
            </motion.p>
          </div>

          {/* Two-column hero split */}
          <div className="landing-hero-split" style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '20px 40px 80px',
            display: 'flex',
            flexDirection: 'row',
            gap: 60,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            {/* Left */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6 }}
              style={{ flex: 1, minWidth: 300 }}
            >
              <div style={{ fontSize: 11, letterSpacing: '0.12em', color: '#2563eb', fontWeight: 600, textTransform: 'uppercase', marginBottom: 12 }}>
                Airserve
              </div>
              <h1 style={{
                fontSize: 'clamp(28px, 4vw, 44px)',
                fontWeight: 700, lineHeight: 1.18,
                color: '#0f172a', letterSpacing: '-0.025em', margin: 0,
              }}>
                Fresh air feels effortless when your service is orchestrated.
              </h1>
              <p style={{ fontSize: 15, color: '#6b7280', marginTop: 16, maxWidth: 420, lineHeight: 1.65 }}>
                Book premium aircon care with trusted technicians, live availability, and photo-proof service summaries.
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/guest-booking')}
                  style={{ background: '#2563eb', color: 'white', borderRadius: 10, padding: '12px 24px', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Book a visit ↗
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/register')}
                  style={{ background: 'white', color: '#0f172a', border: '1.5px solid #d1d5db', borderRadius: 10, padding: '12px 24px', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Create an account
                </motion.button>
              </div>
              <div style={{ display: 'flex', gap: 20, marginTop: 20, flexWrap: 'wrap' }}>
                {['⭐ 4.9 trusted rating', '✓ 100% licensed technicians', '📍 Islandwide coverage'].map(item => (
                  <span key={item} style={{ fontSize: 12, color: '#6b7280' }}>{item}</span>
                ))}
              </div>
            </motion.div>

            {/* Right — booking card (hidden on mobile) */}
            <div className="landing-booking-card" style={{ flex: 1, minWidth: 280, display: 'flex', justifyContent: 'center' }}>
              <BookingCard />
            </div>
          </div>
        </div>
      </BackgroundPaths>

      {/* ── ROLE SELECTOR ────────────────────────────────────────────────────── */}
      <div style={{ background: 'white', padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.15em', color: '#2563eb', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
              Portal Access
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
              Sign in to your role
            </h2>
          </div>
          <div className="landing-role-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {ROLE_CONFIG.map((role, index) => (
              <RoleCard key={role.id} role={role} index={index} onClick={() => handleRoleSelect(role.id)} />
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <span onClick={() => navigate('/guest-booking')}
              style={{ fontSize: 13, color: '#6b7280', cursor: 'pointer', textDecoration: 'underline' }}>
              Continue as guest →
            </span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════ HOW IT WORKS ══════════════════════════ */}
      <div className="landing-section-pad" style={{ background: 'white', padding: '80px 40px' }}>
        <div className="landing-grid" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 48, alignItems: 'start' }}>
          {/* Left — steps */}
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.55 }}
          >
            <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>How it flows</div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 36px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em', margin: '0 0 14px', lineHeight: 1.2 }}>
              A booking journey designed to feel effortless
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.65, margin: '0 0 32px' }}>
              Every step is documented and tracked so you always know what is happening — from the first tap to after-care notes.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {steps.map((step, i) => (
                  <motion.div key={step.title}
                  initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }} transition={{ duration: 0.45, delay: i * 0.1 }}
                  style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: '#2563eb', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{step.title}</div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, lineHeight: 1.55 }}>{step.description}</div>
                  </div>
                  </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right — live status dark card */}
          <motion.div
            initial={{ opacity: 0, x: 28 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.15 }}
            style={{
              background: '#0f172a', borderRadius: 24, padding: '36px 32px',
              color: 'white', position: 'relative', overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(37,99,235,0.3)', filter: 'blur(60px)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 16 }}>Live Status</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 10 }}>Your technician is en route</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 24, lineHeight: 1.6 }}>
                Get auto-updated ETAs, route tracking, and service checklists in real time.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Arrival', value: '18 mins' },
                  { label: 'Assigned expert', value: 'Akira · 4.9 ★' },
                  { label: 'Service checklist', value: '7 items completed' },
                ].map(row => (
                  <div key={row.label} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 18px' }}>
                    <div style={{ fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>{row.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ══════════════════════════ REVIEWS ══════════════════════════════ */}
      <div className="landing-section-pad" style={{ background: '#f8f7f4', padding: '80px 40px', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
        <div className="landing-grid" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 48, alignItems: 'center' }}>
          {/* Left — testimonial cards */}
          <div>
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>Customer notes</div>
              <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 36px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em', margin: '0 0 28px', lineHeight: 1.2 }}>
                Loved by thousands of homes
              </h2>
            </motion.div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {testimonials.map((item, i) => (
                <motion.div key={item.name}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ duration: 0.45, delay: i * 0.1 }}
                  style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: '20px 22px' }}
                >
                  <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
                    {Array.from({ length: item.rating }).map((_, j) => (
                      <span key={j} style={{ color: '#f59e0b', fontSize: 15 }}>★</span>
                    ))}
                  </div>
                  <p style={{ fontSize: 14, color: '#374151', margin: '0 0 12px', lineHeight: 1.6, fontStyle: 'italic' }}>"{item.quote}"</p>
                  <div style={{ fontSize: 11, letterSpacing: '0.15em', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>{item.name}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right — warranty card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.55, delay: 0.15 }}
            style={{ background: 'white', borderRadius: 24, border: '1px solid #e5e7eb', padding: '36px 32px', boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.18em', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Service promise</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>30-day comfort warranty</div>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🛡️</div>
            </div>
            <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.65, margin: '0 0 24px' }}>
              If anything feels off, we will revisit free of charge. Every job is logged with before-and-after photos.
            </p>
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.18em', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Coverage</div>
              <div style={{ fontSize: 14, color: '#0f172a', marginBottom: 6 }}>HDB, condominium, landed, offices, retail</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Available daily 8am – 9pm</div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ══════════════════════════ FAQ ══════════════════════════════════ */}
      <div className="landing-section-pad" style={{ background: 'white', padding: '80px 40px' }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>FAQ</div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 36px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em', margin: '0 0 32px', lineHeight: 1.2 }}>
              Answers before you ask
            </h2>
          </motion.div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {faqs.map((faq, i) => (
              <motion.div key={faq.question}
                initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <FAQItem faq={faq} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════ CTA BANNER ═══════════════════════════ */}
      <div className="landing-section-pad" style={{ background: '#0f172a', padding: '64px 40px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.55 }}
          style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}
        >
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>Ready for better air?</div>
            <div style={{ fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 800, color: 'white', letterSpacing: '-0.025em' }}>Pick a slot in under 60 seconds.</div>
          </div>
          <motion.button
            whileHover={{ background: '#fef3c7' }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/login/customer')}
            style={{ background: 'white', color: '#0f172a', border: 'none', borderRadius: 10, padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}
          >
            Start booking ↗
          </motion.button>
        </motion.div>
      </div>

      {/* ══════════════════════════ FOOTER ═══════════════════════════════ */}
      <footer style={{ background: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '56px 40px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="landing-footer-inner" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 40, marginBottom: 40 }}>
            {/* Brand */}
            <div style={{ minWidth: 200 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'white', marginBottom: 8, letterSpacing: '-0.02em' }}>AirServe</div>
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>Professional aircon servicing, Singapore.</div>
            </div>
            {/* Links */}
            <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'white', fontWeight: 700, textTransform: 'uppercase', marginBottom: 14 }}>Portals</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Customer', path: '/login/customer' },
                    { label: 'Technician', path: '/login/technician' },
                    { label: 'Coordinator', path: '/login/coordinator' },
                  ].map(link => (
                    <button key={link.label} onClick={() => navigate(link.path)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6b7280', textAlign: 'left', padding: 0, fontFamily: 'inherit', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'white'}
                      onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
                    >{link.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'white', fontWeight: 700, textTransform: 'uppercase', marginBottom: 14 }}>Account</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Register', path: '/register' },
                    { label: 'Join as Technician', path: '/apply-technician' },
                    { label: 'Guest Booking', path: '/guest-booking' },
                  ].map(link => (
                    <button key={link.label} onClick={() => navigate(link.path)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6b7280', textAlign: 'left', padding: 0, fontFamily: 'inherit', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'white'}
                      onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
                    >{link.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24, textAlign: 'center', fontSize: 12, color: '#4b5563' }}>
            © {new Date().getFullYear()} AirServe. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Login;
