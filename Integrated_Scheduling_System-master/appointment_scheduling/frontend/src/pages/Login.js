import React, { useState } from 'react';
import { Input, Button, Typography } from "@material-tailwind/react";
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from "../axiosConfig";
import backgroundImage from '../asset/img/air_servicing.png';

const ROLES = [
  { id: 'customer', label: 'Customer', description: 'Book and manage your appointments', icon: '👤' },
  { id: 'technician', label: 'Technician', description: 'View jobs and update availability', icon: '🔧' },
  { id: 'coordinator', label: 'Coordinator', description: 'Manage appointments and technicians', icon: '📋' },
];

function Login() {
    const location = useLocation();
    const pathRole = location.pathname.replace(/^\/login\/?/, '') || null;
    const roleFromPath = ['customer', 'technician', 'coordinator'].includes(pathRole) ? pathRole : null;
    const [selectedRole, setSelectedRole] = useState(roleFromPath);
    const [emailOrPhone, setEmailOrPhone] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    // Sync selectedRole when URL changes (e.g. direct link to /login/customer)
    React.useEffect(() => {
        if (roleFromPath !== selectedRole) setSelectedRole(roleFromPath);
    }, [roleFromPath]);

    const handleRoleSelect = (roleId) => {
        setEmailOrPhone('');
        setPassword('');
        setErrorMessage('');
        navigate(`/login/${roleId}`);
    };

    const handleBackToRoleSelect = () => {
        setEmailOrPhone('');
        setPassword('');
        setErrorMessage('');
        navigate('/login');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setErrorMessage('');

        const endpoint = `/api/${selectedRole}/profile/login/`;

        try {
            // Backend expects 'email' and 'password' keys for all roles (technician uses phone in 'email' field)
            const payload = { email: emailOrPhone, password: password };
            const response = await api.post(endpoint, payload);

            // Clear previous session data
            localStorage.removeItem('customers_id');
            localStorage.removeItem('customers_name');
            localStorage.removeItem('technicians_id');
            localStorage.removeItem('technicians_name');
            localStorage.removeItem('technicians_phone');
            localStorage.removeItem('coordinators_id');
            localStorage.removeItem('coordinators_email');
            localStorage.removeItem('coordinators_name');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');

            if (response.status === 200) {
                // Store JWT tokens
                localStorage.setItem('access_token', response.data.access);
                localStorage.setItem('refresh_token', response.data.refresh);

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
            const msg = error.response?.data?.error || error.response?.data?.detail || 'Login failed. Please try again.';
            setErrorMessage(typeof msg === 'string' ? msg : 'Login failed. Please try again.');
        }
    };

    const isPhoneRole = selectedRole === 'technician';
    const inputLabel = isPhoneRole ? 'Phone' : 'Email';
    const inputPlaceholder = isPhoneRole ? 'e.g. 91234567' : 'name@mail.com';
    const inputType = isPhoneRole ? 'tel' : 'email';

    return (
      <section className="m-8 flex gap-4">
        <div className="w-full lg:w-3/5 mt-24">
          <div className="text-center">
            <Typography variant="h2" className="font-bold mb-4">Login</Typography>
            {!selectedRole ? (
              <Typography variant="paragraph" color="blue-gray" className="text-lg font-normal">
                Choose how you want to sign in
              </Typography>
            ) : (
              <Typography variant="paragraph" color="blue-gray" className="text-lg font-normal">
                Sign in as <span className="font-semibold text-gray-900">{ROLES.find(r => r.id === selectedRole)?.label}</span>
              </Typography>
            )}
          </div>

          {!selectedRole ? (
            <div className="mt-8 mb-2 mx-auto w-full max-w-screen-lg lg:w-2/3 flex flex-col sm:flex-row gap-4 justify-center items-stretch">
              {ROLES.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleRoleSelect(role.id)}
                  className="flex-1 min-w-[180px] p-6 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50/50 transition-all text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <span className="text-3xl mb-2 block">{role.icon}</span>
                  <Typography variant="h6" className="font-bold text-gray-900 mb-1">{role.label}</Typography>
                  <Typography variant="small" color="blue-gray" className="font-normal">{role.description}</Typography>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 mb-2 mx-auto w-80 max-w-screen-lg lg:w-1/2">
              <button
                type="button"
                onClick={handleBackToRoleSelect}
                className="text-sm text-blue-600 hover:text-blue-800 mb-4"
              >
                ← Change account type
              </button>
              <div className="mb-4 flex flex-col gap-6">
                <Typography variant="small" color="blue-gray" className="-mb-3 font-bold">
                  {inputLabel} <span className="text-red-500">*</span>
                </Typography>
                <input
                  id="loginId"
                  type={inputType}
                  placeholder={inputPlaceholder}
                  className="w-full px-3 py-2 text-gray-900 bg-transparent border border-blue-gray-200 rounded-lg focus:border-gray-900 focus:outline-none"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  required
                  aria-label={inputLabel}
                />
              </div>
              <div className="mb-1 flex flex-col gap-6">
                <Typography variant="small" color="blue-gray" className="-mb-3 font-bold">
                  Password <span className="text-red-500">*</span>
                </Typography>
                <input
                  type="password"
                  placeholder="********"
                  className="w-full px-3 py-2 text-gray-900 bg-transparent border border-blue-gray-200 rounded-lg focus:border-gray-900 focus:outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {errorMessage && <p className="text-xs italic text-red-500 mb-2">{errorMessage}</p>}
              <Button className="mt-6" fullWidth type="submit">
                Sign in as {ROLES.find(r => r.id === selectedRole)?.label}
              </Button>

              {selectedRole === 'customer' && (
                <>
                  <Typography variant="paragraph" className="text-center text-blue-gray-500 font-medium mt-4">
                    Not registered? <Link to="/register" className="text-gray-900 ml-1">Create account</Link>
                  </Typography>
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <Typography variant="small" className="text-center text-blue-gray-700 font-medium">
                      Need a one-time service without an account?
                    </Typography>
                    <Link to="/guest-booking">
                      <Button variant="outlined" className="mt-2" fullWidth>
                        Quick Booking (No Account Required)
                      </Button>
                    </Link>
                  </div>
                </>
              )}
              {selectedRole === 'technician' && (
                <>
                  <div className="text-center mt-4">
                    <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800">
                      Forgot Password?
                    </Link>
                  </div>
                  <Typography variant="paragraph" className="text-center text-blue-gray-500 font-medium mt-4">
                    Want to work as a technician? <Link to="/apply-technician" className="text-gray-900 ml-1">Apply here</Link>
                  </Typography>
                </>
              )}
            </form>
          )}
        </div>
        <div className="w-2/5 h-full hidden lg:block">
          <img src={backgroundImage} className="h-full w-full object-cover rounded-3xl" alt="" />
        </div>
      </section>
    );
}

export default Login;
