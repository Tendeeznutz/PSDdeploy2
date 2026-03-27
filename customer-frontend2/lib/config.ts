export const APP_CONFIG = {
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@airserve.sg',
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+65 1234 5678',
  companyName: 'AirServe',
} as const;
