import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function AppShell({ children }) {
  return (
    <div className="layout">
      <Sidebar />
      <div className="content-area">
        <Header />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
