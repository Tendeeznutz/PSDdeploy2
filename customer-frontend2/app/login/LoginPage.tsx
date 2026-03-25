'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Button from '@/components/Button';
import { customerApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Mail, Lock, LogIn, ArrowLeft, CheckCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot password inline state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await customerApi.login(email, password);
      const customer = await customerApi.getProfile(response.customer_id);
      login(customer);
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Invalid email or password.';
      setError(typeof msg === 'string' ? msg : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);

    try {
      await customerApi.forgotPassword(forgotEmail);
      setForgotSuccess(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Something went wrong. Please try again.';
      setForgotError(typeof msg === 'string' ? msg : 'Something went wrong. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setForgotEmail('');
    setForgotError('');
    setForgotSuccess(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow-lg p-8">
            {!showForgotPassword ? (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
                  <p className="text-gray-600">Sign in to manage your bookings</p>
                </div>

                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    isLoading={loading}
                  >
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign In
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Don't have an account?{' '}
                    <Link href="/register" className="text-primary-600 font-medium hover:text-primary-700">
                      Sign up
                    </Link>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Forgot Password</h1>
                  <p className="text-gray-600">Enter your email to receive a reset link</p>
                </div>

                {forgotSuccess ? (
                  <div className="text-center">
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-green-800 text-left">
                        If an account with that email exists, a reset link has been sent to your email.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleBackToLogin}
                      className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Back to Login
                    </button>
                  </div>
                ) : (
                  <>
                    {forgotError && (
                      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">{forgotError}</p>
                      </div>
                    )}

                    <form onSubmit={handleForgotPassword} className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            required
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            placeholder="you@example.com"
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        isLoading={forgotLoading}
                      >
                        <Mail className="w-5 h-5 mr-2" />
                        Send Reset Link
                      </Button>
                    </form>

                    <div className="mt-6 text-center">
                      <button
                        type="button"
                        onClick={handleBackToLogin}
                        className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Login
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
