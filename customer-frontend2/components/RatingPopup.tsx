'use client';

import { useEffect, useState } from 'react';
import { Star, X, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { appointmentApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface UnratedAppointment {
  id: string;
  appointmentStartTime: number;
  appointmentEndTime: number;
  appointmentStatus: string;
  display: {
    technicianName: string;
    airconToService: string[];
    airconBrand: string[];
  };
}

export default function RatingPopup() {
  const { customer } = useAuthStore();
  const [unrated, setUnrated] = useState<UnratedAppointment[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!customer) return;
    if (typeof window !== 'undefined' && sessionStorage.getItem('rating_prompted') === 'true') return;

    const fetchUnrated = async () => {
      try {
        const data = await appointmentApi.getUnratedCompleted(customer.id);
        if (Array.isArray(data) && data.length > 0) {
          setUnrated(data);
          setIsOpen(true);
        }
      } catch (error) {
        console.error('Failed to fetch unrated appointments:', error);
      }
    };

    fetchUnrated();
  }, [customer]);

  const currentAppointment = unrated[currentIndex];

  const handleSubmit = async () => {
    if (!currentAppointment || !customer || rating === 0) return;

    setSubmitting(true);
    try {
      await appointmentApi.rateTechnician(currentAppointment.id, {
        rating,
        customerId: customer.id,
      });
      setSubmitted(true);
      setTimeout(() => {
        moveToNext();
      }, 1200);
    } catch (error) {
      console.error('Failed to submit rating:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const moveToNext = () => {
    setRating(0);
    setHoveredStar(0);
    setSubmitted(false);

    if (currentIndex + 1 < unrated.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      closePopup();
    }
  };

  const closePopup = () => {
    setIsOpen(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('rating_prompted', 'true');
    }
  };

  if (!isOpen || !currentAppointment) return null;

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp * 1000), 'MMM d, yyyy');
  };

  const formatTime = (timestamp: number) => {
    return format(new Date(timestamp * 1000), 'h:mm a');
  };

  const remaining = unrated.length - currentIndex;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={closePopup}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Rate Your Service</h2>
            {unrated.length > 1 && (
              <p className="text-slate-300 text-sm">
                {currentIndex + 1} of {unrated.length} appointments
              </p>
            )}
          </div>
          <button
            onClick={closePopup}
            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-300" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Appointment details */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Date</span>
                <span className="text-slate-800">
                  {formatDate(currentAppointment.appointmentStartTime)} at{' '}
                  {formatTime(currentAppointment.appointmentStartTime)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Technician</span>
                <span className="text-slate-800">{currentAppointment.display.technicianName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Service</span>
                <span className="text-slate-800 text-right">
                  {currentAppointment.display.airconToService.join(', ')}
                </span>
              </div>
              {currentAppointment.display.airconBrand.length > 0 && (
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Brand</span>
                  <span className="text-slate-800">
                    {currentAppointment.display.airconBrand.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Star rating */}
          <div className="text-center mb-6">
            <p className="text-sm font-medium text-slate-700 mb-3">
              How was your experience?
            </p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= (hoveredStar || rating);
                return (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    className="transition-transform duration-150 hover:scale-110"
                    disabled={submitting || submitted}
                  >
                    <Star
                      className={`w-10 h-10 transition-colors duration-150 ${
                        filled
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'fill-none text-slate-300 hover:text-yellow-300'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            {rating > 0 && !submitted && (
              <p className="text-sm text-slate-500 mt-2">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </p>
            )}
            {submitted && (
              <p className="text-sm text-green-600 font-medium mt-2">
                Thank you for your rating!
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={moveToNext}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1"
            >
              {remaining > 1 ? (
                <>
                  Skip <ChevronRight className="w-4 h-4" />
                </>
              ) : (
                'Skip'
              )}
            </button>
            <button
              onClick={handleSubmit}
              disabled={rating === 0 || submitting || submitted}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-xl transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Rating'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
