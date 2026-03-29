'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/buyers', label: 'Buyers' },
  { href: '/listings', label: 'Listings' },
  { href: '/matches', label: 'Matches' },
  { href: '/settings', label: 'Settings' }
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">Dealio</div>
      <div className="muted" style={{ marginBottom: 16 }}>Buyer matching app</div>
      <nav className="nav">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={pathname.startsWith(item.href) ? 'active' : ''}>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
