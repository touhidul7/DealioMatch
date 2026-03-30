'use client';

import { useCallback, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 960) {
        closeSidebar();
      }
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [closeSidebar]);

  return (
    <div className="layout">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="content-area">
        <Header onOpenSidebar={openSidebar} />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
