import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'DroneLab — Flight Laboratory', description:'Design a quadcopter, fly five training missions, and investigate your flight telemetry in a browser.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}