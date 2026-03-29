import './globals.css';
import ToastProvider from '@/components/ToastProvider';

export const metadata = {
  title: 'Dealio App',
  description: 'Buyer and listing matching application'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
