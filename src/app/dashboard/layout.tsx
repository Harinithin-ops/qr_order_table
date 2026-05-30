'use client';

import { HOTEL_NAME } from '@/lib/utils';
import { LayoutDashboard, Receipt, QrCode, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* ── Desktop Sidebar ── */}
      <aside className="w-64 flex-shrink-0 bg-gray-900 text-white hidden md:flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold font-serif">{HOTEL_NAME}</h2>
          <p className="text-xs text-gray-400 mt-1">Admin Portal</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 bg-gray-800 rounded-lg font-medium">
            <LayoutDashboard size={20} /> Orders View
          </Link>
          <Link href="/dashboard/history" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-400 font-medium">
            <Receipt size={20} /> Billing History
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <Link href="/admin/qr" className="flex items-center justify-center gap-2 w-full py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition">
            <QrCode size={16} /> QR Generator
          </Link>
        </div>
      </aside>

      {/* ── Mobile Slide-down Menu Overlay ── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="absolute top-0 left-0 w-64 h-full bg-gray-900 text-white flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold font-serif leading-tight">{HOTEL_NAME}</h2>
                <p className="text-xs text-gray-400 mt-0.5">Admin Portal</p>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-800 transition"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-2">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 bg-gray-800 rounded-lg font-medium"
              >
                <LayoutDashboard size={20} /> Orders View
              </Link>
              <Link
                href="/dashboard/history"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-400 font-medium"
              >
                <Receipt size={20} /> Billing History
              </Link>
            </nav>

            <div className="p-4 border-t border-gray-800">
              <Link
                href="/admin/qr"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
              >
                <QrCode size={16} /> QR Generator
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Top Bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 text-white flex-shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 rounded-lg hover:bg-gray-800 transition"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold font-serif text-base truncate mx-3">{HOTEL_NAME}</span>
          <span className="w-8" />{/* spacer */}
        </header>

        <main className="flex-1 overflow-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
