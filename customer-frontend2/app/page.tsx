'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Button from '@/components/Button';
import { initScrollAnimations } from '@/lib/animations';
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck,
  Clock3,
  Droplets,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Wind,
  Wrench,
} from 'lucide-react';

export default function HomePage() {
  useEffect(() => {
    initScrollAnimations();
  }, []);

  const highlights = [
    {
      title: 'Same-day slots, islandwide',
      description: 'Smart routing pairs you with the closest licensed tech in minutes.',
      icon: Clock3,
    },
    {
      title: 'Transparent menu pricing',
      description: 'Every visit includes checklist photos and a pre-approved quote.',
      icon: BadgeCheck,
    },
    {
      title: 'Care, not just cooling',
      description: 'Indoor air quality tune-ups that keep your home healthy.',
      icon: Sparkles,
    },
  ];

  const serviceMenu = [
    {
      title: 'General Servicing',
      description: 'Deep clean filters, coils, and blower wheels for quiet comfort.',
      icon: Wind,
      price: 'From $50/unit',
    },
    {
      title: 'Chemical Wash',
      description: 'Restore airflow with a full dismantle and odor-free refresh.',
      icon: Droplets,
      price: 'From $80/unit',
    },
    {
      title: 'Troubleshooting',
      description: 'No-cool, leaks, and system diagnostics with verified parts.',
      icon: Wrench,
      price: 'From $60/visit',
    },
  ];

  const steps = [
    {
      title: 'Tell us what you need',
      description: 'Pick the service type and share your unit details.',
    },
    {
      title: 'Choose a time window',
      description: 'Live availability shows slots across the island.',
    },
    {
      title: 'Track your technician',
      description: 'Get real-time updates, arrival ETA, and service photos.',
    },
  ];

  const testimonials = [
    {
      name: 'Chen Wei',
      quote: 'Booked at lunch, serviced by evening. The air is crisp again.',
      rating: 5,
    },
    {
      name: 'Aisha Rahman',
      quote: 'Loved the checklist and photos. Everything felt professional.',
      rating: 5,
    },
  ];

  const faqs = [
    {
      question: 'How do I book an appointment?',
      answer:
        'Tap “Book a visit” and follow the 5-step flow. Choose a service, share your details, and confirm a time.',
    },
    {
      question: 'What areas do you cover?',
      answer:
        'We serve all areas in Singapore, with technicians routed based on availability and proximity.',
    },
    {
      question: 'How much does servicing cost?',
      answer:
        'General servicing starts at $50 per unit, plus a $10 travel fee. Chemical wash is $80 per unit.',
    },
    {
      question: 'Do you provide warranty?',
      answer:
        'Yes. Every visit includes a 30-day warranty. We will revisit free of charge if something feels off.',
    },
    {
      question: 'What payment methods are accepted?',
      answer:
        'We accept cash, card, PayLah/PayNow, bank transfer, and cheques. Payment is collected after service.',
    },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      <section className="pt-24 pb-16 lg:pt-28 lg:pb-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.18),_transparent_55%)]"></div>
        <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[#fbd38d]/60 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#93c5fd]/40 blur-3xl"></div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
            <div data-animate>
              <p className="text-sm uppercase tracking-[0.3em] text-[#0f766e] font-medium">AirServe Studio</p>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-[#111318] mt-4 leading-tight">
                Fresh air feels effortless when your service is orchestrated.
              </h1>
              <p className="mt-5 text-lg text-[#4b5563] max-w-xl">
                Book premium aircon care with trusted technicians, live availability, and photo-proof service summaries.
                Get cooling that feels curated for your space.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link href="/book" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto !bg-[#0f766e] !text-white hover:!bg-[#115e59] focus:!ring-[#0f766e] shadow-[0_20px_40px_rgba(15,118,110,0.2)]"
                  >
                    Book a visit
                    <ArrowUpRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/register" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto !border-[#111318] !text-[#111318] hover:!bg-[#111318] hover:!text-white"
                  >
                    Create an account
                  </Button>
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-6 text-sm text-[#4b5563]" data-animate-stagger>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-[#f59e0b] fill-[#f59e0b]" />
                  <span className="text-[#111318] font-semibold">4.9</span> trusted rating
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#0f766e]" />
                  100% licensed technicians
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#0f766e]" />
                  Islandwide coverage
                </div>
              </div>
            </div>

            <div className="relative" data-animate>
              <div className="absolute inset-0 rounded-3xl bg-[#111318] translate-x-4 translate-y-4"></div>
              <div className="relative rounded-3xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-[#6b7280]">Next available</p>
                    <p className="font-display text-2xl text-[#111318] mt-2">Today, 4:30 PM</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-[#0f766e]/15 flex items-center justify-center">
                    <CalendarCheck className="h-6 w-6 text-[#0f766e]" />
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#9ca3af]">Aircon profile</p>
                    <p className="mt-2 text-sm text-[#111318]">3 units · HDB · overdue 6 months</p>
                  </div>
                  <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#9ca3af]">Assigned crew</p>
                    <p className="mt-2 text-sm text-[#111318]">Zenith Cooling · 12 mins away</p>
                  </div>
                  <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#9ca3af]">Service promise</p>
                    <p className="mt-2 text-sm text-[#111318]">Checklist photos + 30-day warranty</p>
                  </div>
                </div>
                <div className="mt-6 rounded-2xl bg-[#111318] text-white p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-white/60">Estimated total</p>
                    <p className="text-xl font-display">$180 - $220</p>
                  </div>
                  <span className="text-sm text-white/80">Before approval</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-white" data-animate>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-3" data-animate-stagger>
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
                  <div className="h-12 w-12 rounded-xl bg-[#0f766e]/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-[#0f766e]" />
                  </div>
                  <h3 className="font-display text-xl text-[#111318] mt-4">{item.title}</h3>
                  <p className="mt-2 text-sm text-[#6b7280]">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#f7f3ee]" data-animate>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[#0f766e]">Service menu</p>
              <h2 className="font-display text-3xl md:text-4xl text-[#111318] mt-3">
                Crafted services for every aircon mood
              </h2>
            </div>
            <Link href="/services" className="text-sm font-medium text-[#111318] flex items-center gap-2">
              View full list
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3" data-animate-stagger>
            {serviceMenu.map((service) => {
              const Icon = service.icon;
              return (
                <div key={service.title} className="rounded-3xl border border-[#e5e7eb] bg-white p-6 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="h-12 w-12 rounded-2xl bg-[#111318]/10 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-[#111318]" />
                    </div>
                    <span className="text-xs uppercase tracking-[0.25em] text-[#9ca3af]">{service.price}</span>
                  </div>
                  <h3 className="font-display text-2xl text-[#111318] mt-5">{service.title}</h3>
                  <p className="mt-3 text-sm text-[#6b7280]">{service.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-16 bg-white" data-animate>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] items-start">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[#0f766e]">How it flows</p>
              <h2 className="font-display text-3xl md:text-4xl text-[#111318] mt-3">
                A booking journey designed to feel effortless
              </h2>
              <p className="mt-4 text-sm text-[#6b7280]">
                Every step is documented and tracked so you always know what is happening, from the first tap to
                after-care notes.
              </p>
              <div className="mt-8 space-y-5" data-animate-stagger>
                {steps.map((step, index) => (
                  <div key={step.title} className="flex gap-4">
                    <div className="h-10 w-10 rounded-full bg-[#0f766e] text-white flex items-center justify-center font-display">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-display text-lg text-[#111318]">{step.title}</h3>
                      <p className="text-sm text-[#6b7280] mt-1">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-[#e5e7eb] bg-[#111318] text-white p-8 relative overflow-hidden">
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#0f766e]/40 blur-3xl"></div>
              <div className="relative">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Live status</p>
                <h3 className="font-display text-2xl mt-4">Your technician is en route</h3>
                <p className="mt-3 text-sm text-white/70">
                  Get auto-updated ETAs, route tracking, and service checklists in real time.
                </p>
                <div className="mt-6 grid gap-4">
                  <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/60">Arrival</p>
                    <p className="mt-2 text-lg font-display">18 mins</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/60">Assigned expert</p>
                    <p className="mt-2 text-lg font-display">Akira · 4.9★</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/60">Service checklist</p>
                    <p className="mt-2 text-lg font-display">7 items completed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="reviews" className="py-16 bg-[#f7f3ee]" data-animate>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[#0f766e]">Customer notes</p>
              <h2 className="font-display text-3xl md:text-4xl text-[#111318] mt-3">Loved by thousands of homes</h2>
              <div className="mt-8 space-y-4" data-animate-stagger>
                {testimonials.map((item) => (
                  <div key={item.name} className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
                    <div className="flex items-center gap-2 text-[#f59e0b]">
                      {Array.from({ length: item.rating }).map((_, index) => (
                        <Star key={`${item.name}-${index}`} className="h-4 w-4 fill-[#f59e0b]" />
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-[#4b5563]">“{item.quote}”</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.25em] text-[#6b7280]">{item.name}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-[#e5e7eb] bg-white p-8 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-[#9ca3af]">Service promise</p>
                  <h3 className="font-display text-2xl text-[#111318] mt-2">30-day comfort warranty</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-[#0f766e]/10 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-[#0f766e]" />
                </div>
              </div>
              <p className="mt-4 text-sm text-[#6b7280]">
                If anything feels off, we will revisit free of charge. Every job is logged with before-and-after photos.
              </p>
              <div className="mt-6 border-t border-[#e5e7eb] pt-6">
                <p className="text-xs uppercase tracking-[0.25em] text-[#9ca3af]">Coverage</p>
                <p className="mt-2 text-sm text-[#111318]">HDB, condominium, landed, offices, retail</p>
                <p className="mt-2 text-xs text-[#6b7280]">Available daily 8am - 9pm</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="py-16 bg-white" data-animate>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[#0f766e]">FAQ</p>
              <h2 className="font-display text-3xl md:text-4xl text-[#111318] mt-3">
                Answers before you ask
              </h2>
            </div>
          </div>
          <div className="mt-8 grid gap-4">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-5 open:bg-white open:shadow-sm"
              >
                <summary className="font-display text-lg text-[#111318] cursor-pointer list-none flex items-center justify-between">
                  {faq.question}
                  <span className="text-[#0f766e] text-sm transition-transform duration-300 group-open:rotate-90">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-[#6b7280]">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 bg-[#111318] text-white" data-animate>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Ready for better air?</p>
              <h2 className="font-display text-3xl md:text-4xl mt-3">Pick a slot in under 60 seconds.</h2>
            </div>
            <Link href="/book">
              <Button
                size="lg"
                className="!bg-white !text-[#111318] hover:!bg-[#fef3c7] focus:!ring-white"
              >
                Start booking
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
