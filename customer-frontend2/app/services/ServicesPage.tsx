'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ServiceCard from '@/components/ServiceCard';
import Button from '@/components/Button';
import { SERVICES } from '@/lib/constants';
import { ArrowRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { initScrollAnimations } from '@/lib/animations';

export default function ServicesPage() {
  const servicesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    initScrollAnimations();
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f3ee]">
      <Navbar />
      <main className="pt-24 pb-20">
        <section className="relative">
          <div className="absolute inset-0">
            <div className="absolute -top-24 right-10 h-64 w-64 rounded-full bg-[#fde68a]/70 blur-3xl"></div>
            <div className="absolute top-10 left-0 h-72 w-72 rounded-full bg-[#93c5fd]/50 blur-3xl"></div>
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="lg:sticky lg:top-24 self-start" data-animate>
                <p className="text-xs uppercase tracking-[0.35em] text-primary-600 font-medium">
                  AirServe catalog
                </p>
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4">
                  Our Services
                </h1>
                <p className="text-lg text-gray-600 mt-4">
                  Professional aircon services to keep your home cool and comfortable
                </p>
                <div className="mt-8 rounded-2xl border border-white/60 bg-white/80 backdrop-blur p-6 shadow-sm">
                  <p className="text-sm text-gray-600">Need help picking the right service?</p>
                  <p className="mt-2 text-sm text-gray-500">
                    Open any service card to see full details and recommended use cases.
                  </p>
                </div>
              </div>

              <div
                ref={servicesRef}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
                data-animate-stagger
              >
                {SERVICES.map((service, index) => (
                  <div
                    key={service.id}
                    className="service-card-item rounded-3xl border border-white/60 bg-white/90 backdrop-blur shadow-md p-5"
                  >
                    <ServiceCard
                      service={service}
                      rating={4.7 + index * 0.05}
                      reviewCount={Math.floor(Math.random() * 5000) + 500}
                    />
                    <div className="mt-4">
                      <Link href={`/services/${service.id}`}>
                        <Button variant="outline" className="w-full">
                          Learn More
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-[#111827] text-white p-8 md:p-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6" data-animate>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-3">
                  Ready to book a service?
                </h2>
                <p className="text-lg text-white/70">
                  Get started with our easy booking process
                </p>
              </div>
              <Link href="/book">
                <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100">
                  Book Now
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
