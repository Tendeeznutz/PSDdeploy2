'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Button from '@/components/Button';
import { customerApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Mail, Lock, User, Phone, MapPin, Home } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuthStore();
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPassword: '',
    confirmPassword: '',
    customerPhone: '',
    customerAddress: '',
    customerPostalCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.customerPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.customerPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!/^\d{6}$/.test(formData.customerPostalCode)) {
      setError('Postal code must be 6 digits');
      return;
    }

    if (!/^\d{8}$/.test(formData.customerPhone)) {
      setError('Phone number must be 8 digits');
      return;
    }

    setLoading(true);

    try {
      await customerApi.register({
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPassword: formData.customerPassword,
        customerPhone: formData.customerPhone,
        customerAddress: formData.customerAddress,
        customerPostalCode: formData.customerPostalCode,
      });

      const authResponse = await customerApi.login(formData.customerEmail, formData.customerPassword);
      const fullCustomer = await customerApi.getProfile(authResponse.customer_id);
      login(fullCustomer);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
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
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
              <p className="text-gray-600">Sign up to start booking appointments</p>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    name="customerEmail"
                    value={formData.customerEmail}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    name="customerPhone"
                    value={formData.customerPhone}
                    onChange={handleChange}
                    required
                    maxLength={8}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="12345678"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <div className="relative">
                  <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="customerAddress"
                    value={formData.customerAddress}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="123 Main Street"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="customerPostalCode"
                    value={formData.customerPostalCode}
                    onChange={handleChange}
                    required
                    maxLength={6}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="123456"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    name="customerPassword"
                    value={formData.customerPassword}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" isLoading={loading}>
                Create Account
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link href="/login" className="text-primary-600 font-medium hover:text-primary-700">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
