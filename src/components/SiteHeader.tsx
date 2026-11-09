import { Link, useLocation } from "@tanstack/react-router";
import { Disc3, Github } from "lucide-react";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/upload", label: "Studio" },
  { to: "/analyze", label: "Analyze" },
  { to: "/mix", label: "Console" },
  { to: "/export", label: "Export" },
] as const;

export function SiteHeader() {
  const loc = useLocation();

  return (
    <header className="sticky top-0 z-50 px-4 sm:px-8 pt-4">
      <div className="glass-strong mx-auto max-w-7xl rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-magenta)] flex items-center justify-center glow-cyan">
            <Disc3 className="w-5 h-5 text-background animate-spin-slow" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-wide">NARCOTICS<span className="text-gradient-neon">.dj</span></div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">AI Auto Mixer</div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {NAV.map((n) => {
            const active = loc.pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`px-3.5 py-1.5 rounded-full transition-all ${
                  active
                    ? "bg-white/10 text-foreground shadow-inner"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="flex items-center gap-4">
          <a
            href="#"
            className="hidden lg:inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <Github className="w-4 h-4" /> v1.0
          </a>
        </div>
      </div>
    </header>
  );
}

