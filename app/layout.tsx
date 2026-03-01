"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  LayoutDashboard, Briefcase, Star, Bell, History,
  Brain, Users, Settings, Menu, Zap
} from "lucide-react";
import TickerTape from "@/components/ui/TickerTape";
import Toaster from "@/components/ui/Toaster";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchInterval: 30_000 } },
});

const navItems = [
  { href: "/",          label: "Dashboard",  icon: LayoutDashboard },
  { href: "/portfolio", label: "Portfolio",  icon: Briefcase },
  { href: "/watchlist", label: "Watchlist",  icon: Star },
  { href: "/alerts",    label: "Alerts",     icon: Bell },
  { href: "/trades",    label: "Trades",     icon: History },
  { href: "/insights",  label: "Insights",   icon: Brain },
  { href: "/insiders",  label: "Insiders",   icon: Users },
  { href: "/settings",  label: "Settings",   icon: Settings },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const [sideOpen, setSideOpen] = useState(false);

  return (
    <html lang="en">
      <head>
        <title>Phantom Trade — Signal Over Noise</title>
        <meta name="description" content="Advanced portfolio intelligence & signal tracking" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#080B14" />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          {/* Ambient glow orbs */}
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute top-[-20%] left-[30%] w-[600px] h-[400px] rounded-full opacity-[0.04]"
                 style={{ background: "radial-gradient(circle, #3B82F6, transparent)" }} />
            <div className="absolute bottom-[10%] right-[20%] w-[400px] h-[300px] rounded-full opacity-[0.03]"
                 style={{ background: "radial-gradient(circle, #8B5CF6, transparent)" }} />
          </div>

          {/* Ticker tape */}
          <div className="fixed top-0 left-0 right-0 z-50 h-8 bg-phantom-void/95 border-b border-phantom-border backdrop-blur-sm overflow-hidden">
            <TickerTape />
          </div>

          <div className="flex h-screen pt-8">
            {/* Sidebar */}
            <aside className={`fixed inset-y-8 left-0 z-40 w-56 flex flex-col transition-transform duration-300
              bg-phantom-void/95 border-r border-phantom-border backdrop-blur-xl
              ${sideOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>

              {/* Logo */}
              <div className="flex items-center gap-3 px-5 py-5 border-b border-phantom-border">
                <div className="w-8 h-8 rounded-lg bg-phantom-signal/20 flex items-center justify-center border border-phantom-signal/30">
                  <Zap className="w-4 h-4 text-phantom-signal" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-phantom-star tracking-wide">PHANTOM</div>
                  <div className="text-[10px] text-phantom-ghost tracking-widest uppercase">Trade Intelligence</div>
                </div>
              </div>

              {/* Nav */}
              <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {navItems.map(({ href, label, icon: Icon }) => {
                  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                  return (
                    <Link key={href} href={href}
                      onClick={() => setSideOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group
                        ${active
                          ? "bg-phantom-signal/10 text-phantom-star border border-phantom-signal/20"
                          : "text-phantom-ghost hover:text-phantom-silver hover:bg-phantom-surface"}`}>
                      <Icon className={`w-4 h-4 flex-shrink-0
                        ${active ? "text-phantom-signal" : "text-phantom-ghost group-hover:text-phantom-silver"}`} />
                      <span className="font-medium">{label}</span>
                      {label === "Alerts" && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-phantom-nova alert-ring" />
                      )}
                    </Link>
                  );
                })}
              </nav>

              <div className="px-4 py-3 border-t border-phantom-border">
                <div className="flex items-center gap-2 text-xs text-phantom-ghost">
                  <div className="w-1.5 h-1.5 rounded-full bg-phantom-nova animate-pulse" />
                  <span>Market live</span>
                  <span className="ml-auto font-mono">v1.0</span>
                </div>
              </div>
            </aside>

            {/* Mobile overlay */}
            {sideOpen && (
              <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
                   onClick={() => setSideOpen(false)} />
            )}

            {/* Main content */}
            <main className="flex-1 lg:ml-56 overflow-y-auto bg-phantom-abyss relative z-10">
              <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-phantom-border bg-phantom-void/80 backdrop-blur-sm sticky top-0 z-20">
                <button onClick={() => setSideOpen(true)}
                  className="p-2 rounded-lg text-phantom-ghost hover:text-phantom-star hover:bg-phantom-surface">
                  <Menu className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-phantom-signal" />
                  <span className="text-sm font-semibold text-phantom-star">PHANTOM</span>
                </div>
                <div className="w-9" />
              </div>
              <div className="min-h-full p-4 lg:p-6">
                {children}
              </div>
            </main>
          </div>
          <Toaster />
        </QueryClientProvider>
      </body>
    </html>
  );
}
