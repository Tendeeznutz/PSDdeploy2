import React, { useState } from 'react';
import { Button, Typography } from "@material-tailwind/react";
import { Link } from 'react-router-dom';
import api from "../axiosConfig";
import backgroundImage from '../asset/img/air_servicing.png';

function ForgotPassword() {
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage('');
        setError('');
        setLoading(true);

        try {
            const response = await api.post(`/api/technicians/forgot-password/`, {
                phone: phone
            });

            setMessage(response.data.message || 'Password reset email sent successfully');
            setEmailSent(true);
        } catch (err) {
            console.error('Forgot password error:', err);
            setError(err.response?.data?.error || 'Failed to send password reset email. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="m-8 flex gap-4">
            <div className="w-full lg:w-3/5 mt-24">
                <div className="text-center">
                    <Typography variant="h2" className="font-bold mb-4">Forgot Password</Typography>
                    <Typography variant="paragraph" color="blue-gray" className="text-lg font-normal">
                        Enter your phone number to receive a password reset link
                    </Typography>
                </div>

                {!emailSent ? (
                    <form onSubmit={handleSubmit} className="mt-8 mb-2 mx-auto w-80 max-w-screen-lg lg:w-1/2">
                        <Link to="/login/technician" className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block">
                            ← Back to Login
                        </Link>
                        <div className="mb-4 flex flex-col gap-6">
                            <Typography variant="small" color="blue-gray" className="-mb-3 font-bold">
                                Phone Number <span className="text-red-500">*</span>
                            </Typography>
                            <input
                                id="phone"
                                type="tel"
                                placeholder="e.g. 91234567"
                                className="w-full px-3 py-2 text-gray-900 bg-transparent border border-blue-gray-200 rounded-lg focus:border-gray-900 focus:outline-none"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                                pattern="[0-9]{8}"
                                title="Phone number must be 8 digits"
                            />
                        </div>

                        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
                        {message && <p className="text-sm text-green-500 mb-4">{message}</p>}

                        <Button
                            className="mt-6"
                            fullWidth
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </Button>
                    </form>
                ) : (
                    <div className="mt-8 mb-2 mx-auto w-80 max-w-screen-lg lg:w-1/2 text-center">
                        <div className="p-6 bg-green-50 rounded-lg border border-green-200 mb-6">
                            <Typography variant="paragraph" className="text-green-700">
                                {message}
                            </Typography>
                            <Typography variant="small" color="blue-gray" className="mt-2">
                                Please check your email for the password reset link.
                            </Typography>
                        </div>
                        <Link to="/login/technician">
                            <Button variant="outlined" fullWidth>
                                Return to Login
                            </Button>
                        </Link>
                    </div>
                )}
            </div>
            <div className="w-2/5 h-full hidden lg:block">
                <img src={backgroundImage} className="h-full w-full object-cover rounded-3xl" alt="" />
            </div>
        </section>
    );
}

export default ForgotPassword;
