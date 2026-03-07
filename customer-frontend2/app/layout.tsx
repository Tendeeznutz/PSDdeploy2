import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AirServe - Premium Aircon Servicing',
  description: 'Book professional aircon servicing with licensed technicians. Fast, reliable, and transparent pricing.',
  keywords: 'aircon service, air conditioning, maintenance, Singapore',
  openGraph: {
    title: 'AirServe - Premium Aircon Servicing',
    description: 'Book professional aircon servicing with licensed technicians.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
