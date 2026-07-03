/**
 * DashboardLayout — shell containing the navbar and an outlet for routed pages.
 */
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function DashboardLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}