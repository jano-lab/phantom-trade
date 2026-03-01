import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Phantom Trade design system
        phantom: {
          void:     "#06080F",  // deepest background
          abyss:   "#080B14",  // main bg
          deep:    "#0D1117",  // card bg
          surface: "#111827",  // elevated surface
          border:  "#1C2333",  // subtle border
          muted:   "#1E2D40",  // muted bg
          ghost:   "#7C8B9E",  // secondary text
          silver:  "#A8B3C1",  // tertiary text
          star:    "#E8EEF5",  // primary text
          nova:    "#00FF88",  // positive / buy
          pulse:   "#FF3B5C",  // negative / sell
          signal:  "#3B82F6",  // accent blue
          amber:   "#F59E0B",  // warning / watch
          violet:  "#8B5CF6",  // insights
          cyan:    "#06B6D4",  // data points
        },
      },
      fontFamily: {
        mono:    ["var(--font-mono)", "JetBrains Mono", "Fira Code", "monospace"],
        sans:    ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "phantom-gradient":
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(59,130,246,0.08), transparent)",
        "nova-glow":
          "radial-gradient(circle at center, rgba(0,255,136,0.15), transparent 70%)",
        "pulse-glow":
          "radial-gradient(circle at center, rgba(255,59,92,0.15), transparent 70%)",
        "grid-pattern":
          "linear-gradient(rgba(28,35,51,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(28,35,51,0.4) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid-sm": "40px 40px",
      },
      boxShadow: {
        "nova":   "0 0 20px rgba(0,255,136,0.25), 0 0 60px rgba(0,255,136,0.08)",
        "pulse":  "0 0 20px rgba(255,59,92,0.25), 0 0 60px rgba(255,59,92,0.08)",
        "signal": "0 0 20px rgba(59,130,246,0.25), 0 0 60px rgba(59,130,246,0.08)",
        "card":   "0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(28,35,51,0.8)",
        "glass":  "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
      },
      animation: {
        "pulse-slow":   "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float":        "float 6s ease-in-out infinite",
        "ticker-slide": "ticker-slide 30s linear infinite",
        "glow-pulse":   "glow-pulse 2s ease-in-out infinite",
        "fade-in":      "fade-in 0.3s ease-out",
        "slide-up":     "slide-up 0.3s ease-out",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-4px)" },
        },
        "ticker-slide": {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6" },
          "50%":      { opacity: "1" },
        },
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
