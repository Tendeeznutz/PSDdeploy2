'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Button from '@/components/Button';
import { customerApi } from '@/lib/api';
import { Lock, KeyRound, ArrowLeft, CheckCircle } from 'lucide-react';

function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/^[a-zA-Z0-9]+$/.test(password)) {
    return 'Password must contain only alphanumeric characters.';
  }
  const digitCount = (password.match(/\d/g) || []).length;
  if (digitCount < 3) {
    return 'Password must contain at least 3 digits.';
  }
  return null;
}

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [customerName, setCustomerName] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setTokenError('No reset token provided.');
      return;
    }

    const validate = async () => {
      try {
        const data = await customerApi.validateResetToken(token);
        if (data.valid) {
          setTokenValid(true);
          setCustomerName(data.customerName || '');
        } else {
          setTokenError(data.error || 'This reset link is invalid or has expired.');
        }
      } catch {
        setTokenError('This reset link is invalid or has expired.');
      } finally {
        setValidating(false);
      }
    };

    validate();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await customerApi.resetPassword(token, newPassword);
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to reset password. Please try again.';
      setError(typeof msg === 'string' ? msg : 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow-lg p-8">
            {validating ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-4 animate-pulse">
                  <KeyRound className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-600">Validating your reset link...</p>
              </div>
            ) : !tokenValid ? (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4">
                  <KeyRound className="w-6 h-6 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Reset Link</h1>
                <p className="text-gray-600 mb-6">{tokenError}</p>
                <Link
                  href="/forgot-password"
                  className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Request a new reset link
                </Link>
              </div>
            ) : success ? (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Successful</h1>
                <p className="text-gray-600 mb-4">
                  Your password has been reset successfully. You will be redirected to the login page shortly.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Go to Login
                </Link>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full mb-4">
                    <KeyRound className="w-6 h-6 text-primary-600" />
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h1>
                  {customerName && (
                    <p className="text-gray-600">Hi {customerName}, enter your new password below</p>
                  )}
                  {!customerName && (
                    <p className="text-gray-600">Enter your new password below</p>
                  )}
                </div>

                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="••••••••"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Min 8 alphanumeric characters, at least 3 digits
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    isLoading={loading}
                  >
                    <KeyRound className="w-5 h-5 mr-2" />
                    Reset Password
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to Login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
