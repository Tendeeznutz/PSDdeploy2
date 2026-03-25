'use client'

import InactivityTimer from './InactivityTimer'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <InactivityTimer />
    </>
  )
}
