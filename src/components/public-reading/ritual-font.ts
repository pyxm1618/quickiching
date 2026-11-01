import { Kaushan_Script } from 'next/font/google';

// Loaded by the EN/ZH ritual home routes, without changing shared header typography.
export const ritualBrush = Kaushan_Script({
  variable: '--font-ritual-brush',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
});
