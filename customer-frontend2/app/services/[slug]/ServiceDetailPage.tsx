'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Button from '@/components/Button';
import { SERVICES, ADD_ONS } from '@/lib/constants';
import { ArrowRight, Check, X, Star, Clock, Shield, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import { initScrollAnimations } from '@/lib/animations';

const serviceDetails: Record<string, {
  included: string[];
  excluded: string[];
  duration: string;
  warranty: string;
  faq: { question: string; answer: string }[];
}> = {
  general: {
    included: [
      'Thorough cleaning of filters',
      'Cleaning of evaporator and condenser coils',
      'Checking refrigerant levels',
      'Cleaning drain pan and drain line',
      'Testing thermostat functionality',
      'General inspection of unit',
    ],
    excluded: ['Replacement of parts', 'Chemical cleaning', 'Gas refill (if needed)'],
    duration: '1-2 hours per unit',
    warranty: '30 days',
    faq: [
      {
        question: 'How often should I service my aircon?',
        answer: 'We recommend servicing every 3-4 months for optimal performance and efficiency.',
      },
      {
        question: 'What if my aircon needs repairs?',
        answer: 'Our technician will identify any issues and provide a quote for repairs.',
      },
    ],
  },
  chemical: {
    included: [
      'Deep chemical cleaning',
      'Removal of stubborn dirt and grime',
      'Sanitization of all components',
      'Filter replacement (if needed)',
      'Complete system inspection',
    ],
    excluded: ['Major repairs', 'Gas refill (charged separately)'],
    duration: '2-3 hours per unit',
    warranty: '60 days',
    faq: [
      {
        question: 'When should I get a chemical wash?',
        answer: 'Chemical wash is recommended every 6-12 months or when regular servicing is not sufficient.',
      },
      {
        question: 'Is it safe for my aircon?',
        answer: 'Yes, we use industry-standard chemicals that are safe for your aircon unit and your family.',
      },
    ],
  },
  troubleshooting: {
    included: [
      'Diagnostic inspection',
      'Identification of issues',
      'Basic repairs (if possible)',
      'Detailed report of findings',
      'Recommendations for fixes',
    ],
    excluded: ['Replacement parts', 'Major repairs (quoted separately)'],
    duration: '1-2 hours',
    warranty: '30 days on diagnostic work',
    faq: [
      {
        question: "What if the issue can't be fixed on the spot?",
        answer: "Our technician will provide a detailed report and quote for any necessary repairs.",
      },
      {
        question: "Do you charge if you can't fix it?",
        answer: 'Yes, the troubleshooting fee covers the diagnostic service. Any repairs are quoted separately.',
      },
    ],
  },
  installation: {
    included: [
      'Site inspection',
      'Installation of new unit',
      'Electrical connections',
      'Testing and commissioning',
      'Basic setup instructions',
    ],
    excluded: ['Cost of aircon unit', 'Additional electrical work', 'Wall modifications'],
    duration: '3-5 hours',
    warranty: '90 days on installation work',
    faq: [
      {
        question: 'Do I need to buy the aircon unit separately?',
        answer: 'Yes, installation service covers the labor and setup.',
      },
      {
        question: 'What if my home needs electrical upgrades?',
        answer: "Our technician will assess during the site inspection and provide a quote.",
      },
    ],
  },
  'gas-topup': {
    included: [
      'Refrigerant gas refill',
      'Leak detection',
      'System pressure testing',
      'Performance check',
    ],
    excluded: ['Repair of leaks (quoted separately)', 'Replacement of components'],
    duration: '1-2 hours',
    warranty: '60 days',
    faq: [
      {
        question: 'How do I know if my aircon needs gas?',
        answer: 'Common signs include reduced cooling, longer time to cool, or ice formation on the unit.',
      },
      {
        question: "What if there's a leak?",
        answer: "If a leak is detected, we'll provide a quote for repair.",
      },
    ],
  },
};

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const service = SERVICES.find(s => s.id === slug);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    initScrollAnimations();
  }, []);

  if (!service) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="pt-24 pb-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Service not found</h1>
          <Link href="/services">
            <Button>Back to Services</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const details = serviceDetails[slug] || serviceDetails.general;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="mb-6" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-sm text-gray-600">
              <li><Link href="/" className="hover:text-primary-600">Home</Link></li>
              <ChevronRight className="w-4 h-4" />
              <li><Link href="/services" className="hover:text-primary-600">Services</Link></li>
              <ChevronRight className="w-4 h-4" />
              <li className="text-gray-900 font-medium">{service.name}</li>
            </ol>
          </nav>

          <div className="bg-white rounded-2xl shadow-lg overflow-hidden" data-animate>
            <div className="bg-gradient-to-r from-primary-600 to-accent-600 p-8 md:p-12 text-white">
              <div className="text-6xl mb-4">{service.icon}</div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{service.name}</h1>
              <p className="text-lg text-primary-100">{service.description}</p>
              <div className="mt-6 flex items-center space-x-4">
                <div className="flex items-center">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="ml-1 font-semibold">4.8</span>
                  <span className="ml-1 text-primary-100">(1,200+ reviews)</span>
                </div>
                <div className="flex items-center">
                  <Clock className="w-5 h-5" />
                  <span className="ml-1">{details.duration}</span>
                </div>
              </div>
            </div>

            <div className="p-8 md:p-12 space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Pricing</h2>
                <div className="bg-primary-50 rounded-lg p-6">
                  {service.basePrice > 0 ? (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Starting at</p>
                      <p className="text-4xl font-bold text-primary-600">S${service.basePrice}</p>
                      <p className="text-sm text-gray-600 mt-2">Flat rate service</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Starting at</p>
                      <p className="text-4xl font-bold text-primary-600">S${service.pricePerUnit}</p>
                      <p className="text-sm text-gray-600 mt-2">Per unit + S$10 travel fee</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">What's Included</h2>
                <ul className="space-y-3">
                  {details.included.map((item, index) => (
                    <li key={index} className="flex items-start space-x-3">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Not Included</h2>
                <ul className="space-y-3">
                  {details.excluded.map((item, index) => (
                    <li key={index} className="flex items-start space-x-3">
                      <X className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-2">
                    <Clock className="w-5 h-5 text-primary-600" />
                    <h3 className="font-semibold text-gray-900">Duration</h3>
                  </div>
                  <p className="text-gray-700">{details.duration}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-2">
                    <Shield className="w-5 h-5 text-primary-600" />
                    <h3 className="font-semibold text-gray-900">Warranty</h3>
                  </div>
                  <p className="text-gray-700">{details.warranty} warranty</p>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
                <div className="space-y-4">
                  {details.faq.map((faq, index) => (
                    <details
                      key={index}
                      className="group bg-gray-50 rounded-lg p-5 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <summary className="font-semibold text-gray-900 flex items-center justify-between">
                        {faq.question}
                        <ChevronRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
                      </summary>
                      <p className="mt-3 text-gray-700">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t">
                <Link href={`/book?service=${service.id}`}>
                  <Button size="lg" className="w-full md:w-auto">
                    Book This Service
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
