'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle,
  HelpCircle,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { initScrollAnimations } from '@/lib/animations';

const faqs = [
  {
    question: 'How do I book an appointment?',
    answer:
      'Simply click "Book Now" and follow the easy 5-step process. Select your service, choose a date and time, and confirm your booking.',
  },
  {
    question: 'What are your service areas?',
    answer:
      'We serve all areas in Singapore. Our technicians are strategically located to provide fast service across the island.',
  },
  {
    question: 'How much does servicing cost?',
    answer:
      'General servicing starts at $50 per unit, plus a $10 travel fee. Chemical wash is $80 per unit. See our services section for detailed pricing.',
  },
  {
    question: 'Do you provide warranty?',
    answer: 'Yes, all our services come with a 30-day warranty. Extended warranty options are available as add-ons.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept cash, credit/debit cards, PayLah/PayNow, bank transfers, and cheques.',
  },
  {
    question: 'Can I reschedule my appointment?',
    answer:
      'Yes, you can reschedule your appointment up to 24 hours before the scheduled time. Visit your booking details to make changes.',
  },
  {
    question: 'What if I need to cancel?',
    answer:
      'You can cancel your appointment from your dashboard. Cancellations made more than 24 hours in advance are free.',
  },
  {
    question: 'How long does a service take?',
    answer:
      'General servicing takes 1-2 hours per unit. Chemical wash takes 2-3 hours per unit. Our technician will provide an estimated time during the service.',
  },
];

export default function SupportPage() {
  const [showContactModal, setShowContactModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bookingReference: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    initScrollAnimations();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setShowContactModal(false);
      setSubmitted(false);
      setFormData({ name: '', email: '', bookingReference: '', message: '' });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#f7f3ee]">
      <Navbar />
      <main className="pt-24 pb-20">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute -top-32 right-6 h-72 w-72 rounded-full bg-[#fde68a]/70 blur-3xl"></div>
            <div className="absolute top-20 left-0 h-80 w-80 rounded-full bg-[#93c5fd]/40 blur-3xl"></div>
          </div>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] items-center">
              <div data-animate>
                <p className="text-xs uppercase tracking-[0.35em] text-primary-600 font-medium">Support desk</p>
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4">
                  Help & Support
                </h1>
                <p className="text-lg text-gray-600 mt-4">
                  We are here to help with any questions or concerns.
                </p>
                <div className="mt-6 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 rounded-full bg-white/80 border border-white/60 px-4 py-2 text-sm text-gray-700">
                    <Phone className="h-4 w-4 text-primary-600" />
                    +65 1234 5678
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-white/80 border border-white/60 px-4 py-2 text-sm text-gray-700">
                    <Mail className="h-4 w-4 text-primary-600" />
                    support@airserve.sg
                  </div>
                </div>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Button
                    className="w-full sm:w-auto !bg-[#0f766e] !text-white hover:!bg-[#115e59]"
                    onClick={() => setShowContactModal(true)}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Send us a message
                  </Button>
                  <Link href="/book" className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto !border-[#111318] !text-[#111318] hover:!bg-[#111318] hover:!text-white"
                    >
                      Book a service
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="grid gap-4" data-animate-stagger>
                <Link
                  href="/dashboard"
                  className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-sm group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Self service</p>
                      <h3 className="text-xl font-semibold text-gray-900 mt-2">Track booking</h3>
                      <p className="text-sm text-gray-600 mt-2">View appointment status and updates.</p>
                    </div>
                    <Calendar className="h-8 w-8 text-primary-600" />
                  </div>
                  <span className="mt-4 inline-flex items-center text-sm text-primary-600">
                    Go to dashboard
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>

                <Link
                  href="/dashboard"
                  className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-sm group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Account</p>
                      <h3 className="text-xl font-semibold text-gray-900 mt-2">Manage bookings</h3>
                      <p className="text-sm text-gray-600 mt-2">Reschedule, cancel, or add notes.</p>
                    </div>
                    <BookOpen className="h-8 w-8 text-primary-600" />
                  </div>
                  <span className="mt-4 inline-flex items-center text-sm text-primary-600">
                    View dashboard
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>

                <Link
                  href="/book"
                  className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-sm group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">New appointment</p>
                      <h3 className="text-xl font-semibold text-gray-900 mt-2">Book now</h3>
                      <p className="text-sm text-gray-600 mt-2">Schedule a new service visit in minutes.</p>
                    </div>
                    <Calendar className="h-8 w-8 text-primary-600" />
                  </div>
                  <span className="mt-4 inline-flex items-center text-sm text-primary-600">
                    Start booking
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">
              <div className="rounded-3xl bg-white p-8 shadow-lg" data-animate>
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-6 h-6 text-primary-600" />
                  <h2 className="text-2xl font-bold text-gray-900">Frequently Asked Questions</h2>
                </div>
                <div className="mt-6 space-y-4" data-animate-stagger>
                  {faqs.map((faq) => (
                    <details
                      key={faq.question}
                      className="group rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-5 open:bg-white open:shadow-sm"
                    >
                      <summary className="font-semibold text-gray-900 flex items-center justify-between cursor-pointer">
                        {faq.question}
                        <span className="text-primary-600 transition-transform duration-300 group-open:rotate-90">
                          +
                        </span>
                      </summary>
                      <p className="mt-3 text-sm text-gray-700">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-[#111827] text-white p-8" data-animate>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-white" />
                  <h2 className="text-2xl font-bold">Our service promise</h2>
                </div>
                <p className="mt-4 text-sm text-white/70">
                  Every ticket is tracked and handled by a dedicated support specialist within 24 hours.
                </p>
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/60">Response time</p>
                    <p className="mt-2 text-lg font-semibold">Under 24 hours</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/60">Service guarantee</p>
                    <p className="mt-2 text-lg font-semibold">30-day warranty</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/60">Availability</p>
                    <p className="mt-2 text-lg font-semibold">Mon-Sat, 9AM-6PM</p>
                  </div>
                </div>
                <Button
                  className="mt-8 w-full !bg-white !text-[#111827] hover:!bg-[#fef3c7]"
                  onClick={() => setShowContactModal(true)}
                >
                  Contact support
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Modal
        isOpen={showContactModal}
        onClose={() => {
          setShowContactModal(false);
          setSubmitted(false);
        }}
        title="Contact Support"
      >
        {submitted ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Message Sent!</h3>
            <p className="text-gray-600">We'll get back to you within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Booking Reference (Optional)</label>
              <input
                type="text"
                value={formData.bookingReference}
                onChange={(e) => setFormData({ ...formData, bookingReference: e.target.value })}
                placeholder="e.g., BK12345678"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
              <textarea
                required
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="How can we help you?"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowContactModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Send Message
              </Button>
            </div>
            <p className="text-xs text-gray-500 text-center mt-4">
              TODO: Integrate with support API endpoint when available
            </p>
          </form>
        )}
      </Modal>

      <Footer />
    </div>
  );
}
