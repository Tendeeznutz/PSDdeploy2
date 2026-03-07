'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Button from '@/components/Button';
import { CheckCircle, Download, Mail, Calendar, MapPin, Package, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { SERVICES, ADD_ONS, TRAVEL_FEE } from '@/lib/constants';

function BookingSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contentRef = useRef<HTMLDivElement>(null);
  const [bookingData, setBookingData] = useState<any>(null);

  useEffect(() => {
    // Get booking data from URL params or localStorage
    const storedData = localStorage.getItem('lastBooking');
    if (storedData) {
      const parsed = JSON.parse(storedData);
      // Convert date string back to Date object
      if (parsed.date) {
        parsed.date = new Date(parsed.date);
      }
      setBookingData(parsed);
    } else {
      // Create mock data if none exists
      setBookingData({
        bookingId: 'BK' + Date.now().toString().slice(-8),
        service: 'General Servicing',
        units: 1,
        addOns: ['Filter Replacement'],
        date: new Date(),
        time: '11:00 AM',
        address: '123 Main Street',
        postalCode: '123456',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '12345678',
        paymentMethod: 'Credit/Debit Card',
        total: 90,
      });
    }

    // Animate content on mount
    if (contentRef.current) {
      contentRef.current.style.opacity = '0';
      contentRef.current.style.transform = 'translateY(20px)';
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
          contentRef.current.style.opacity = '1';
          contentRef.current.style.transform = 'translateY(0)';
        }
      }, 100);
    }
  }, []);

  const calculateTotal = () => {
    if (!bookingData) return 0;
    const service = SERVICES.find(s => s.name === bookingData.service);
    if (!service) return bookingData.total || 0;
    
    const serviceCost = service.basePrice > 0 
      ? service.basePrice 
      : service.pricePerUnit * (bookingData.units || 1);
    
    const addOnsCost = ADD_ONS
      .filter(addon => bookingData.addOns?.includes(addon.name))
      .reduce((sum, addon) => sum + addon.price, 0);
    
    return serviceCost + addOnsCost + TRAVEL_FEE;
  };

  const downloadPDF = async () => {
    // Create a printable version of the invoice
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to download the invoice');
      return;
    }

    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${bookingData?.bookingId}</title>
          <style>
            @media print {
              body { margin: 0; }
            }
            body {
              font-family: 'Inter', sans-serif;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              border-bottom: 2px solid #0ea5e9;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .invoice-details {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
            }
            .section {
              margin-bottom: 25px;
            }
            .section h3 {
              color: #0ea5e9;
              margin-bottom: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #e5e7eb;
            }
            th {
              background-color: #f9fafb;
              font-weight: 600;
            }
            .total {
              text-align: right;
              font-size: 24px;
              font-weight: bold;
              color: #0ea5e9;
              margin-top: 20px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="color: #0ea5e9; margin: 0;">AirServe</h1>
            <p style="color: #6b7280; margin: 5px 0;">Professional Aircon Servicing</p>
          </div>
          
          <div class="invoice-details">
            <div>
              <h2 style="margin: 0 0 10px 0;">Invoice</h2>
              <p style="margin: 5px 0; color: #6b7280;">Booking ID: ${bookingData?.bookingId}</p>
              <p style="margin: 5px 0; color: #6b7280;">Date: ${format(new Date(), 'MMMM d, yyyy')}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 5px 0;"><strong>Bill To:</strong></p>
              <p style="margin: 5px 0;">${bookingData?.name}</p>
              <p style="margin: 5px 0;">${bookingData?.email}</p>
              <p style="margin: 5px 0;">${bookingData?.phone}</p>
            </div>
          </div>

          <div class="section">
            <h3>Service Details</h3>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align: right;">Quantity</th>
                  <th style="text-align: right;">Unit Price</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${bookingData?.service}</td>
                  <td style="text-align: right;">${bookingData?.units || 1}</td>
                  <td style="text-align: right;">S$${SERVICES.find(s => s.name === bookingData?.service)?.pricePerUnit || SERVICES.find(s => s.name === bookingData?.service)?.basePrice || 50}</td>
                  <td style="text-align: right;">S$${SERVICES.find(s => s.name === bookingData?.service)?.basePrice > 0 ? SERVICES.find(s => s.name === bookingData?.service)?.basePrice : (SERVICES.find(s => s.name === bookingData?.service)?.pricePerUnit || 50) * (bookingData?.units || 1)}</td>
                </tr>
                ${bookingData?.addOns?.map((addon: string) => {
                  const addonObj = ADD_ONS.find(a => a.name === addon);
                  return addonObj ? `
                    <tr>
                      <td>${addonObj.name}</td>
                      <td style="text-align: right;">1</td>
                      <td style="text-align: right;">S$${addonObj.price}</td>
                      <td style="text-align: right;">S$${addonObj.price}</td>
                    </tr>
                  ` : '';
                }).join('') || ''}
                <tr>
                  <td>Travel Fee</td>
                  <td style="text-align: right;">1</td>
                  <td style="text-align: right;">S$${TRAVEL_FEE}</td>
                  <td style="text-align: right;">S$${TRAVEL_FEE}</td>
                </tr>
              </tbody>
            </table>
            <div class="total">
              Total: S$${calculateTotal()}
            </div>
          </div>

          <div class="section">
            <h3>Appointment Information</h3>
                          <p><strong>Date:</strong> ${bookingData?.date ? (typeof bookingData.date === 'string' ? format(new Date(bookingData.date), 'MMMM d, yyyy') : format(bookingData.date, 'MMMM d, yyyy')) : format(new Date(), 'MMMM d, yyyy')}</p>
            <p><strong>Time:</strong> ${bookingData?.time || '11:00 AM'}</p>
            <p><strong>Address:</strong> ${bookingData?.address}, Singapore ${bookingData?.postalCode}</p>
            <p><strong>Payment Method:</strong> ${bookingData?.paymentMethod}</p>
          </div>

          <div class="footer">
            <p>Thank you for choosing AirServe!</p>
            <p>This invoice has been sent to ${bookingData?.email}</p>
            <p>For any inquiries, please contact us at support@airserve.sg</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (!bookingData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="pt-24 pb-16 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div ref={contentRef} className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
            {/* Success Header */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                Booking Confirmed!
              </h1>
              <p className="text-lg text-gray-600">
                Your appointment has been successfully booked
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Booking ID: <span className="font-semibold">{bookingData.bookingId}</span>
              </p>
            </div>

            {/* Invoice Section */}
            <div className="border-t border-gray-200 pt-8 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Invoice</h2>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={downloadPDF}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </Button>
                </div>
              </div>

              {/* Invoice Content */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">Bill To</h3>
                    <p className="font-medium text-gray-900">{bookingData.name}</p>
                    <p className="text-sm text-gray-600">{bookingData.email}</p>
                    <p className="text-sm text-gray-600">{bookingData.phone}</p>
                  </div>
                  <div className="text-right">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">Invoice Details</h3>
                    <p className="text-sm text-gray-600">Date: {format(new Date(), 'MMMM d, yyyy')}</p>
                    <p className="text-sm text-gray-600">Invoice #: {bookingData.bookingId}</p>
                  </div>
                </div>

                {/* Service Items */}
                <div className="border-t border-gray-200 pt-6">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 text-sm font-semibold text-gray-700">Description</th>
                        <th className="text-right py-3 text-sm font-semibold text-gray-700">Qty</th>
                        <th className="text-right py-3 text-sm font-semibold text-gray-700">Unit Price</th>
                        <th className="text-right py-3 text-sm font-semibold text-gray-700">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-3">
                          <p className="font-medium text-gray-900">{bookingData.service}</p>
                        </td>
                        <td className="text-right py-3 text-gray-600">{bookingData.units || 1}</td>
                        <td className="text-right py-3 text-gray-600">
                          S${SERVICES.find(s => s.name === bookingData.service)?.basePrice > 0 
                            ? SERVICES.find(s => s.name === bookingData.service)?.basePrice 
                            : SERVICES.find(s => s.name === bookingData.service)?.pricePerUnit || 50}
                        </td>
                        <td className="text-right py-3 font-medium text-gray-900">
                          S${SERVICES.find(s => s.name === bookingData.service)?.basePrice > 0 
                            ? SERVICES.find(s => s.name === bookingData.service)?.basePrice 
                            : (SERVICES.find(s => s.name === bookingData.service)?.pricePerUnit || 50) * (bookingData.units || 1)}
                        </td>
                      </tr>
                      {bookingData.addOns?.map((addon: string) => {
                        const addonObj = ADD_ONS.find(a => a.name === addon);
                        return addonObj ? (
                          <tr key={addon} className="border-b border-gray-100">
                            <td className="py-3 text-gray-600">{addonObj.name}</td>
                            <td className="text-right py-3 text-gray-600">1</td>
                            <td className="text-right py-3 text-gray-600">S${addonObj.price}</td>
                            <td className="text-right py-3 font-medium text-gray-900">S${addonObj.price}</td>
                          </tr>
                        ) : null;
                      })}
                      <tr className="border-b border-gray-100">
                        <td className="py-3 text-gray-600">Travel Fee</td>
                        <td className="text-right py-3 text-gray-600">1</td>
                        <td className="text-right py-3 text-gray-600">S${TRAVEL_FEE}</td>
                        <td className="text-right py-3 font-medium text-gray-900">S${TRAVEL_FEE}</td>
                      </tr>
                    </tbody>
                  </table>
                  
                  <div className="mt-6 flex justify-end">
                    <div className="text-right">
                      <div className="text-sm text-gray-600 mb-2">Total Amount</div>
                      <div className="text-3xl font-bold text-primary-600">S${calculateTotal()}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Appointment Details */}
              <div className="bg-primary-50 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary-600" />
                  Appointment Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Date & Time</p>
                    <p className="font-medium text-gray-900">
                      {bookingData.date ? (typeof bookingData.date === 'string' ? format(new Date(bookingData.date), 'MMMM d, yyyy') : format(bookingData.date, 'MMMM d, yyyy')) : format(new Date(), 'MMMM d, yyyy')} at {bookingData.time || '11:00 AM'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Service Address
                    </p>
                    <p className="font-medium text-gray-900">
                      {bookingData.address}, Singapore {bookingData.postalCode}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 flex items-center gap-1">
                      <Package className="w-4 h-4" />
                      Units
                    </p>
                    <p className="font-medium text-gray-900">{bookingData.units || 1} unit(s)</p>
                  </div>
                  <div>
                    <p className="text-gray-600 flex items-center gap-1">
                      <CreditCard className="w-4 h-4" />
                      Payment Method
                    </p>
                    <p className="font-medium text-gray-900">{bookingData.paymentMethod}</p>
                  </div>
                </div>
              </div>

              {/* Email Notification */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900 mb-1">Invoice Sent</p>
                    <p className="text-sm text-blue-800">
                      A copy of this invoice has been sent to <strong>{bookingData.email}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6 border-t border-gray-200">
                <Link href="/dashboard" className="flex-1 sm:flex-none">
                  <Button variant="outline" className="w-full sm:w-auto">
                    View Dashboard
                  </Button>
                </Link>
                <Link href="/" className="flex-1 sm:flex-none">
                  <Button className="w-full sm:w-auto">
                    Back to Home
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

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="pt-24 pb-16 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
        <Footer />
      </div>
    }>
      <BookingSuccessContent />
    </Suspense>
  );
}
