import type { ServiceOption } from '@/lib/types';
import { Star } from 'lucide-react';

interface ServiceCardProps {
  service: ServiceOption;
  onSelect?: (serviceId: string) => void;
  isSelected?: boolean;
  rating?: number;
  reviewCount?: number;
}

// Placeholder image URLs - using Unsplash for aircon-related images
const placeholderImages: Record<string, string> = {
  general: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400&h=300&fit=crop',
  chemical: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&h=300&fit=crop',
  troubleshooting: 'https://images.unsplash.com/photo-1621905251189-08b45ddf6e0d?w=400&h=300&fit=crop',
  installation: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=400&h=300&fit=crop',
  'gas-topup': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
};

export default function ServiceCard({ 
  service, 
  onSelect, 
  isSelected,
  rating = 4.8,
  reviewCount = 1200
}: ServiceCardProps) {
  const displayPrice = service.basePrice > 0 
    ? service.basePrice 
    : service.pricePerUnit;
  
  const priceLabel = service.basePrice > 0 
    ? 'flat rate' 
    : 'per unit';

  const imageUrl = placeholderImages[service.id] || placeholderImages.general;

  return (
    <div
      onClick={() => onSelect?.(service.id)}
      className={`group relative bg-white rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden hover-lift ${
        isSelected
          ? 'border-primary-600 shadow-xl ring-2 ring-primary-200'
          : 'border-gray-200 hover:border-primary-400'
      }`}
    >
      {/* Service Image */}
      <div className={`h-40 relative overflow-hidden ${
        isSelected ? 'bg-primary-50' : 'bg-gray-50 group-hover:bg-primary-50'
      } transition-colors`}>
        <img
          src={imageUrl}
          alt={service.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {/* Overlay with icon */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent flex items-center justify-center">
          <div className="text-5xl drop-shadow-lg">{service.icon}</div>
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{service.name}</h3>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{service.description}</p>
        
        {/* Rating */}
        <div className="flex items-center gap-1 mb-4">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="text-sm font-medium text-gray-900">{rating}</span>
          <span className="text-sm text-gray-500">({reviewCount.toLocaleString()})</span>
        </div>

        {/* Pricing - Prominent */}
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">Starting at</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-900">S${displayPrice}</span>
                {service.basePrice === 0 && (
                  <span className="text-sm text-gray-600 ml-1">per unit</span>
                )}
              </div>
            </div>
            {isSelected && (
              <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
