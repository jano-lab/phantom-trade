"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  LayoutDashboard, Briefcase, Star, Bell, History,
  Brain, Users, Settings, Menu, X, Zap, TrendingUp,
} from "lucide-react";
import TickerTape from "@/components/ui/TickerTape";
import Toaster    from "@/components/ui/Toaster";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchInterval: 30_000 } },
});

const NAV = [
  { href: "/",          label: "Dashboard",  icon: LayoutDashboard },
  { href: "/portfolio", label: "Portfolio",  icon: Briefcase },
  { href: "/watchlist", label: "Watchlist",  icon: Star },
  { href: "/alerts",    label: "Alerts",     icon: Bell },
  { href: "/trades",    label: "Trades",     icon: History },
  { href: "/insights",  label: "Insights",   icon: Brain },
  { href: "/insiders",  label: "Insiders",   icon: Users },
  { href: "/settings",  label: "Settings",   icon: Settings },
];

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-[#1E1E2E] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#4F7FFF]/15 border border-[#4F7FFF]/25 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-[#4F7FFF]" />
          </div>
          <div>
            <div className="text-[13px] font-bold text-white tracking-wider">PHANTOM</div>
            <div className="text-[9px] text-[#424659] tracking-[0.18em] uppercase font-medium">Trade Intelligence</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="btn-icon lg:hidden">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        <div className="section-label mt-1 mb-2">Navigation</div>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} onClick={onClose}
              className={`nav-item ${active ? "active" : ""}`}>
              <Icon className={`nav-icon w-4 h-4 flex-shrink-0 transition-colors ${active ? "text-[#4F7FFF]" : "text-[#7A8195]"}`} />
              <span>{label}</span>
              {label === "Alerts" && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00D472] alert-ring flex-shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Status bar */}
      <div className="px-4 py-4 border-t border-[#1E1E2E] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="dot-live" />
          <span className="text-[11px] text-[#7A8195] font-medium">Market Live</span>
          <span className="ml-auto text-[10px] font-mono text-[#424659]">v2.0</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#424659]">
          <TrendingUp className="w-3 h-3" />
          <span>Phantom Trade Intelligence</span>
        </div>
      </div>
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <html lang="en">
      <head>
        <title>Phantom Trade — Signal Over Noise</title>
        <meta name="description" content="Advanced portfolio intelligence & signal tracking" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>

          {/* ── Mobile sidebar overlay ── */}
          {mobileOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                   onClick={() => setMobileOpen(false)} />
              <aside className="absolute left-0 top-0 h-full w-58 flex flex-col bg-[#080810] border-r border-[#1E1E2E] animate-slide-up z-10"
                     style={{ width: 232 }}>
                <Sidebar onClose={() => setMobileOpen(false)} />
              </aside>
            </div>
          )}

          {/* ── App shell: CSS grid — sidebar NEVER overlaps content ── */}
          <div className="app-shell">

            {/* Desktop sidebar — in normal document flow, no position:fixed */}
            <aside className="sidebar hidden lg:flex">
              <Sidebar />
            </aside>

            {/* Content column */}
            <div className="content-col">

              {/* Ticker tape — fixed height, no overflow */}
              <div className="flex-shrink-0 h-8 border-b border-[#1E1E2E] bg-[#000000] overflow-hidden">
                <TickerTape />
              </div>

              {/* Mobile top bar */}
              <div className="lg:hidden flex-shrink-0 flex items-center justify-between px-4 h-12 border-b border-[#1E1E2E] bg-[#080810]">
                <button onClick={() => setMobileOpen(true)}
                  className="btn-icon">
                  <Menu className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#4F7FFF]" />
                  <span className="text-sm font-bold text-white tracking-wider">PHANTOM</span>
                </div>
                <div className="w-8" />
              </div>

              {/* Page content — fills remaining height, scrolls internally */}
              <main className="page-content">
                {children}
              </main>

            </div>
          </div>

          <Toaster />
        </QueryClientProvider>
      </body>
    </html>
  );
}
