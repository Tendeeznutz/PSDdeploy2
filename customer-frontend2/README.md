# AirServe Customer Frontend

Premium customer-facing frontend for the AirServe aircon dispatch system. Built with Next.js 14, TypeScript, Tailwind CSS, and GSAP animations.

## Features

- 🎨 **Premium UI/UX** - Modern, clean design with smooth animations
- 📱 **Fully Responsive** - Mobile-first design that works on all devices
- ⚡ **Fast & Optimized** - Built with Next.js for optimal performance
- 🎭 **GSAP Animations** - Smooth scroll-triggered animations with reduced motion support
- 🔐 **Authentication** - Customer login and registration
- 📅 **Booking System** - Multi-step booking wizard
- 📊 **Dashboard** - View and manage appointments
- 🎯 **Accessibility** - Semantic HTML, ARIA labels, keyboard navigation

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: GSAP with ScrollTrigger
- **Forms**: React Hook Form
- **State Management**: Zustand
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Django backend running on `http://127.0.0.1:8000`

### Installation

1. Navigate to the customer-frontend directory:
```bash
cd customer-frontend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env.local` file (optional):
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
customer-frontend/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Landing page
│   ├── book/              # Booking wizard
│   ├── dashboard/         # Customer dashboard
│   ├── bookings/[id]/     # Booking details
│   ├── login/             # Login page
│   └── register/          # Registration page
├── components/            # Reusable components
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   ├── Button.tsx
│   ├── ServiceCard.tsx
│   └── ...
├── lib/                   # Utilities and API
│   ├── api.ts            # API integration
│   ├── types.ts          # TypeScript types
│   ├── store.ts          # State management
│   └── constants.ts      # Constants
└── public/               # Static assets
```

## Available Routes

- `/` - Landing page with services, testimonials, FAQ
- `/book` - Multi-step booking wizard
- `/dashboard` - Customer dashboard (requires auth)
- `/bookings/[id]` - Booking details page (requires auth)
- `/login` - Customer login
- `/register` - Customer registration

## API Integration

The frontend integrates with the Django REST API backend. All API calls are handled in `lib/api.ts`.

### Endpoints Used

- `POST /api/customers/login` - Customer login
- `POST /api/customers` - Customer registration
- `GET /api/customers/:id` - Get customer profile
- `GET /api/appointments?customerId=:id` - Get customer appointments
- `GET /api/appointments/:id` - Get appointment details
- `POST /api/appointments` - Create appointment
- `PATCH /api/appointments/:id` - Update/cancel appointment
- `GET /api/customeraircondevices?customerId=:id` - Get aircon devices

## Features in Detail

### Landing Page
- Hero section with animated text reveal
- Trust signals (licensed techs, transparent pricing, etc.)
- Services grid with scroll animations
- How it works section
- Customer testimonials
- FAQ accordion
- Call-to-action sections

### Booking Wizard
5-step process:
1. **Service Selection** - Choose service type and aircon units
2. **Address** - Enter service address and postal code
3. **Schedule** - Select date and time slot
4. **Contact** - Enter contact information
5. **Review** - Review and confirm booking

### Dashboard
- View appointments by status (Upcoming, Completed, Cancelled)
- Quick access to booking details
- Empty states with helpful messages

### Booking Details
- Status timeline visualization
- Complete booking information
- Technician details (when assigned)
- Cancel booking functionality

## Animations

GSAP animations are used throughout the site with:
- ScrollTrigger for scroll-based reveals
- Staggered animations for lists
- Smooth transitions between states
- **Reduced motion support** - Respects `prefers-reduced-motion`

## Styling

The project uses Tailwind CSS with a custom design system:
- Primary colors: Blue shades (`primary-*`)
- Accent colors: Purple shades (`accent-*`)
- Consistent spacing scale
- Responsive breakpoints
- Custom animations

## Development

### Build for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
```

## Notes

- The frontend uses Next.js API rewrites to proxy requests to the Django backend
- Authentication state is stored in localStorage (via Zustand)
- All forms include validation and error handling
- The booking wizard supports both logged-in and guest users

## Troubleshooting

### API Connection Issues
- Ensure the Django backend is running on `http://127.0.0.1:8000`
- Check CORS settings in Django `settings.py`
- Verify API endpoints are accessible

### Build Errors
- Clear `.next` folder and rebuild
- Check Node.js version (requires 18+)
- Reinstall dependencies

## License

Part of the Integrated Scheduling System project.
