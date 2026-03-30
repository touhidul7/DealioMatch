'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/buyers', label: 'Buyers', icon: '🧑‍💼' },
  { href: '/listings', label: 'Listings', icon: '🏷️' },
  { href: '/matches', label: 'Matches', icon: '🤝' },
  { href: '/settings', label: 'Settings', icon: '⚙️' }
];

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname();

  useEffect(() => {
    onClose?.();
  }, [pathname, onClose]);

  return (
    <>
      <div className={`sidebar-backdrop ${isOpen ? 'is-open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
      <div className="sidebar-top">
        <div className="brand">Dealio</div>
        <button className="sidebar-close" type="button" onClick={onClose} aria-label="Close navigation menu">
          Close
        </button>
      </div>
      <div className="muted" style={{ marginBottom: 16 }}>Buyer matching app</div>
      <nav className="nav">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={pathname.startsWith(item.href) ? 'active' : ''}>
            <span aria-hidden="true" style={{ marginRight: 8 }}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
      </aside>
    </>
  );
}
