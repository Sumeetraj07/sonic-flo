import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { SiteHeader } from "../components/SiteHeader";
import { AmbientBackground } from "../components/AmbientBackground";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong max-w-md text-center p-10 rounded-3xl">
        <h1 className="text-7xl font-display font-bold text-gradient-neon">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Track not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This page doesn't exist in the mix.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium btn-neon"
        >
          Back to studio
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AURA.dj — AI Auto DJ Mixer" },
      { name: "description", content: "Premium AI DJ mixing studio. Upload tracks, get a seamless professional DJ mix in seconds." },
      { property: "og:title", content: "AURA.dj — AI Auto DJ Mixer" },
      { property: "og:description", content: "Upload tracks. Get a flawless DJ mix. Powered by AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <AmbientBackground />
      <SiteHeader />
      <main className="min-h-screen">
        <Outlet />
      </main>
      <footer className="px-4 sm:px-8 py-10 text-center text-xs text-muted-foreground">
        © 2026 AURA.dj — Crafted for sound.
      </footer>
    </>
  );
}
