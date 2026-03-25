'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Button from '@/components/Button';
import { SERVICES, ADD_ONS, TRAVEL_FEE } from '@/lib/constants';
import { Calculator, ArrowRight, Info } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { initScrollAnimations } from '@/lib/animations';

export default function EstimatePage() {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const [serviceType, setServiceType] = useState<string>('');
  const [numberOfUnits, setNumberOfUnits] = useState(1);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [urgency, setUrgency] = useState<'normal' | 'priority'>('normal');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    initScrollAnimations();
  }, []);

  const calculateEstimate = () => {
    if (!serviceType) return { min: 0, max: 0 };

    const service = SERVICES.find(s => s.id === serviceType);
    if (!service) return { min: 0, max: 0 };

    const baseServiceCost = service.basePrice > 0
      ? service.basePrice
      : service.pricePerUnit * numberOfUnits;

    const addOnsCost = ADD_ONS
      .filter(addon => selectedAddOns.includes(addon.id))
      .reduce((sum, addon) => sum + addon.price, 0);

    const urgencyFee = urgency === 'priority' ? 20 : 0;

    const baseTotal = baseServiceCost + addOnsCost + TRAVEL_FEE + urgencyFee;

    // Add 10% variance for estimate range
    return {
      min: Math.floor(baseTotal * 0.9),
      max: Math.ceil(baseTotal * 1.1),
    };
  };

  const estimate = calculateEstimate();
  const canProceed = !!serviceType && numberOfUnits > 0;

  const handleContinue = () => {
    const params = new URLSearchParams();
    if (serviceType) params.set('service', serviceType);
    params.set('units', numberOfUnits.toString());
    selectedAddOns.forEach(id => params.append('addons', id));
    if (urgency === 'priority') params.set('priority', 'true');
    router.push(`/book?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12" data-animate>
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calculator className="w-8 h-8 text-primary-600" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Price Estimator
            </h1>
            <p className="text-lg text-gray-600">
              Get an instant estimate for your aircon service
            </p>
          </div>

          <div ref={contentRef} className="bg-white rounded-2xl shadow-lg p-8 md:p-12" data-animate>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Input Section */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Service Type *
                  </label>
                  <div className="space-y-2">
                    {SERVICES.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setServiceType(service.id)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          serviceType === service.id
                            ? 'border-primary-600 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{service.name}</p>
                            <p className="text-sm text-gray-600">{service.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              {service.basePrice > 0
                                ? `S$${service.basePrice}`
                                : `S$${service.pricePerUnit}/unit`}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Number of Units *
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setNumberOfUnits(Math.max(1, numberOfUnits - 1))}
                      className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                    >
                      <span className="text-xl">−</span>
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={numberOfUnits}
                      onChange={(e) => setNumberOfUnits(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                      className="w-20 px-4 py-2 border rounded-lg text-center font-semibold focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => setNumberOfUnits(Math.min(20, numberOfUnits + 1))}
                      className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                    >
                      <span className="text-xl">+</span>
                    </button>
                    <span className="text-sm text-gray-600">
                      {numberOfUnits} {numberOfUnits === 1 ? 'unit' : 'units'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Add-ons (Optional)
                  </label>
                  <div className="space-y-2">
                    {ADD_ONS.map((addon) => (
                      <label
                        key={addon.id}
                        className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAddOns.includes(addon.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAddOns([...selectedAddOns, addon.id]);
                            } else {
                              setSelectedAddOns(selectedAddOns.filter(id => id !== addon.id));
                            }
                          }}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{addon.name}</p>
                          <p className="text-sm text-gray-600">{addon.description}</p>
                        </div>
                        <p className="font-semibold text-gray-900">+S${addon.price}</p>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Service Urgency
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="urgency"
                        value="normal"
                        checked={urgency === 'normal'}
                        onChange={() => setUrgency('normal')}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Normal</p>
                        <p className="text-sm text-gray-600">Standard scheduling</p>
                      </div>
                    </label>
                    <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="urgency"
                        value="priority"
                        checked={urgency === 'priority'}
                        onChange={() => setUrgency('priority')}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Priority Service</p>
                        <p className="text-sm text-gray-600">Faster response (+S$20)</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Estimate Display */}
              <div className="lg:sticky lg:top-24">
                <div className="bg-gradient-to-br from-primary-600 to-accent-600 rounded-xl p-8 text-white">
                  <h2 className="text-2xl font-bold mb-6">Estimated Cost</h2>
                  
                  {canProceed ? (
                    <>
                      <div className="mb-6">
                        <p className="text-sm text-primary-100 mb-2">Price Range</p>
                        <div className="flex items-baseline space-x-2">
                          <span className="text-5xl font-bold">S${estimate.min}</span>
                          <span className="text-2xl text-primary-200">-</span>
                          <span className="text-5xl font-bold">S${estimate.max}</span>
                        </div>
                      </div>

                      <div className="bg-white/10 rounded-lg p-4 mb-6 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Service</span>
                          <span className="font-semibold">
                            {SERVICES.find(s => s.id === serviceType)?.name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Units</span>
                          <span className="font-semibold">{numberOfUnits}</span>
                        </div>
                        {selectedAddOns.length > 0 && (
                          <div className="flex justify-between">
                            <span>Add-ons</span>
                            <span className="font-semibold">
                              +S${ADD_ONS.filter(a => selectedAddOns.includes(a.id)).reduce((sum, a) => sum + a.price, 0)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Travel Fee</span>
                          <span className="font-semibold">S${TRAVEL_FEE}</span>
                        </div>
                        {urgency === 'priority' && (
                          <div className="flex justify-between">
                            <span>Priority Fee</span>
                            <span className="font-semibold">+S$20</span>
                          </div>
                        )}
                      </div>

                      <div className="bg-yellow-400/20 border border-yellow-400/30 rounded-lg p-4 mb-6">
                        <div className="flex items-start space-x-2">
                          <Info className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-yellow-100">
                            * Final cost may vary based on actual service required and inspection findings.
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={handleContinue}
                        size="lg"
                        className="w-full bg-white text-primary-600 hover:bg-gray-100"
                      >
                        Continue to Booking
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-primary-100">Select a service to get an estimate</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
