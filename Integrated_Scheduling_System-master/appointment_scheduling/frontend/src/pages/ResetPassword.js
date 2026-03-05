import React, { useState, useEffect } from 'react';
import { Button, Typography } from "@material-tailwind/react";
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import axios from "axios";
import backgroundImage from '../asset/img/air_servicing.png';

function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [validatingToken, setValidatingToken] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const [technicianName, setTechnicianName] = useState('');
    const [resetSuccess, setResetSuccess] = useState(false);

    // Password validation states
    const [passwordErrors, setPasswordErrors] = useState([]);

    useEffect(() => {
        const validateToken = async () => {
            if (!token) {
                setError('No reset token provided');
                setValidatingToken(false);
                return;
            }

            const baseUrl = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';

            try {
                const response = await axios.get(`${baseUrl}/api/technicians/validate-reset-token/?token=${token}`);
                if (response.data.valid) {
                    setTokenValid(true);
                    setTechnicianName(response.data.technicianName || '');
                } else {
                    setError(response.data.error || 'Invalid or expired token');
                }
            } catch (err) {
                setError(err.response?.data?.error || 'Invalid or expired token');
            } finally {
                setValidatingToken(false);
            }
        };

        validateToken();
    }, [token]);

    const validatePassword = (password) => {
        const errors = [];

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }

        if (!/^[a-zA-Z0-9]+$/.test(password)) {
            errors.push('Password must contain only alphanumeric characters (letters and numbers)');
        }

        const digitCount = (password.match(/\d/g) || []).length;
        if (digitCount < 3) {
            errors.push('Password must contain at least 3 numbers');
        }

        return errors;
    };

    const handlePasswordChange = (e) => {
        const value = e.target.value;
        setNewPassword(value);
        setPasswordErrors(validatePassword(value));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage('');
        setError('');

        // Validate password
        const errors = validatePassword(newPassword);
        if (errors.length > 0) {
            setPasswordErrors(errors);
            return;
        }

        // Check password confirmation
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        const baseUrl = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';

        try {
            const response = await axios.post(`${baseUrl}/api/technicians/reset-password/`, {
                token: token,
                newPassword: newPassword
            });

            setMessage(response.data.message || 'Password has been reset successfully');
            setResetSuccess(true);
        } catch (err) {
            console.error('Reset password error:', err);
            setError(err.response?.data?.error || 'Failed to reset password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (validatingToken) {
        return (
            <section className="m-8 flex gap-4">
                <div className="w-full lg:w-3/5 mt-24 text-center">
                    <Typography variant="h4" className="font-bold mb-4">Validating token...</Typography>
                </div>
            </section>
        );
    }

    return (
        <section className="m-8 flex gap-4">
            <div className="w-full lg:w-3/5 mt-24">
                <div className="text-center">
                    <Typography variant="h2" className="font-bold mb-4">Reset Password</Typography>
                    {tokenValid && technicianName && (
                        <Typography variant="paragraph" color="blue-gray" className="text-lg font-normal">
                            Resetting password for: <span className="font-semibold">{technicianName}</span>
                        </Typography>
                    )}
                </div>

                {!tokenValid ? (
                    <div className="mt-8 mb-2 mx-auto w-80 max-w-screen-lg lg:w-1/2 text-center">
                        <div className="p-6 bg-red-50 rounded-lg border border-red-200 mb-6">
                            <Typography variant="paragraph" className="text-red-700">
                                {error || 'Invalid or expired token'}
                            </Typography>
                            <Typography variant="small" color="blue-gray" className="mt-2">
                                Please request a new password reset link.
                            </Typography>
                        </div>
                        <Link to="/forgot-password">
                            <Button variant="outlined" fullWidth>
                                Request New Reset Link
                            </Button>
                        </Link>
                    </div>
                ) : resetSuccess ? (
                    <div className="mt-8 mb-2 mx-auto w-80 max-w-screen-lg lg:w-1/2 text-center">
                        <div className="p-6 bg-green-50 rounded-lg border border-green-200 mb-6">
                            <Typography variant="paragraph" className="text-green-700">
                                {message}
                            </Typography>
                            <Typography variant="small" color="blue-gray" className="mt-2">
                                You can now log in with your new password.
                            </Typography>
                        </div>
                        <Link to="/login/technician">
                            <Button fullWidth>
                                Go to Login
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="mt-8 mb-2 mx-auto w-80 max-w-screen-lg lg:w-1/2">
                        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <Typography variant="small" className="text-blue-700 font-medium">
                                Password Requirements:
                            </Typography>
                            <ul className="list-disc list-inside text-sm text-blue-600 mt-2">
                                <li>Minimum 8 characters</li>
                                <li>Only alphanumeric characters (letters and numbers)</li>
                                <li>At least 3 numbers</li>
                            </ul>
                        </div>

                        <div className="mb-4 flex flex-col gap-6">
                            <Typography variant="small" color="blue-gray" className="-mb-3 font-bold">
                                New Password <span className="text-red-500">*</span>
                            </Typography>
                            <input
                                type="password"
                                placeholder="Enter new password"
                                className="w-full px-3 py-2 text-gray-900 bg-transparent border border-blue-gray-200 rounded-lg focus:border-gray-900 focus:outline-none"
                                value={newPassword}
                                onChange={handlePasswordChange}
                                required
                            />
                            {passwordErrors.length > 0 && (
                                <ul className="list-disc list-inside text-sm text-red-500 -mt-4">
                                    {passwordErrors.map((err, index) => (
                                        <li key={index}>{err}</li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="mb-4 flex flex-col gap-6">
                            <Typography variant="small" color="blue-gray" className="-mb-3 font-bold">
                                Confirm Password <span className="text-red-500">*</span>
                            </Typography>
                            <input
                                type="password"
                                placeholder="Confirm new password"
                                className="w-full px-3 py-2 text-gray-900 bg-transparent border border-blue-gray-200 rounded-lg focus:border-gray-900 focus:outline-none"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>

                        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

                        <Button
                            className="mt-6"
                            fullWidth
                            type="submit"
                            disabled={loading || passwordErrors.length > 0}
                        >
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </Button>

                        <div className="text-center mt-4">
                            <Link to="/login/technician" className="text-sm text-blue-600 hover:text-blue-800">
                                Cancel and return to login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
            <div className="w-2/5 h-full hidden lg:block">
                <img src={backgroundImage} className="h-full w-full object-cover rounded-3xl" alt="" />
            </div>
        </section>
    );
}

export default ResetPassword;
