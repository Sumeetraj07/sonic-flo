import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, Waves, Zap, Music2, ArrowRight, Headphones, Disc3 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NARCOTICS.dj — AI Auto DJ Mixer" },
      { name: "description", content: "Drop your tracks. AI builds a seamless professional DJ mix with BPM matching, harmonic transitions, and energy flow." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative">
      {/* HERO */}
      <section className="px-4 sm:px-8 pt-16 sm:pt-24 pb-20">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--neon-cyan)]" />
            AI-Powered DJ Engine
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mt-6 font-display font-bold text-5xl sm:text-7xl lg:text-8xl leading-[0.95] tracking-tight"
          >
            Mix like a pro.
            <br />
            <span className="text-gradient-neon">In one click.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground"
          >
            Upload up to 20 tracks. Our AI analyzes BPM, key, and energy — then crafts a seamless,
            club-ready continuous DJ set with intelligent transitions.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              to="/upload"
              className="btn-neon inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold"
            >
              Start Mixing <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#features"
              className="glass inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm hover:bg-white/10 transition"
            >
              <Headphones className="w-4 h-4" /> See how it works
            </a>
          </motion.div>

          {/* Animated equalizer hero device */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.4 }}
            className="mt-16 relative max-w-5xl mx-auto"
          >
            <div className="glass-strong rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(ellipse at center, oklch(0.7 0.25 195 / 0.4), transparent 60%)" }} />
              <div className="relative grid grid-cols-2 gap-6">
                {/* Deck A */}
                <DeckPreview label="DECK A" track="Midnight Pulse" bpm="124.0" hue="195" />
                <DeckPreview label="DECK B" track="Velvet Drop" bpm="124.0" hue="330" reverse />
              </div>
              {/* Equalizer */}
              <div className="relative mt-6 flex items-end justify-center gap-1 h-16">
                {Array.from({ length: 48 }).map((_, i) => (
                  <span
                    key={i}
                    className="eq-bar w-1.5 rounded-full bg-gradient-to-t from-[var(--neon-cyan)] to-[var(--neon-magenta)]"
                    style={{ height: `${20 + ((i * 37) % 80)}%`, animationDelay: `${(i % 12) * 0.07}s` }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="px-4 sm:px-8 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-5xl font-bold">Everything a DJ does. <span className="text-gradient">Automated.</span></h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">From BPM matching to harmonic mixing — the AI handles every detail.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Feature icon={<Waves />} title="Smart Analysis" body="BPM, key, energy, loudness and structure detected for every track." />
            <Feature icon={<Zap />} title="Seamless Crossfades" body="Equal-power transitions with bass swap and tempo matching." />
            <Feature icon={<Music2 />} title="Energy Curves" body="Tracks ordered for a perfect emotional arc — build, peak, release." />
            <Feature icon={<Sparkles />} title="5 Mix Modes" body="Club, Festival, Chill, Lounge or House Party — pick a vibe." />
            <Feature icon={<Headphones />} title="Studio Quality" body="Pro-grade audio rendering. Export as broadcast-ready WAV." />
            <Feature icon={<Disc />} title="Up to 20 Tracks" body="Build full sets in minutes — drag, drop, done." />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-8 pb-24">
        <div className="max-w-5xl mx-auto glass-strong rounded-3xl p-10 sm:p-14 text-center relative overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-40" style={{ background: "radial-gradient(circle, oklch(0.7 0.25 195 / 0.5), transparent 70%)" }} />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-40" style={{ background: "radial-gradient(circle, oklch(0.7 0.27 330 / 0.5), transparent 70%)" }} />
          <h3 className="relative font-display text-3xl sm:text-5xl font-bold">Your dancefloor is waiting.</h3>
          <p className="relative mt-3 text-muted-foreground">Drop your first set in under a minute.</p>
          <Link to="/upload" className="relative btn-neon inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold mt-8">
            Open Upload Studio <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function Disc(props: { className?: string }) {
  return <Disc3 {...props} />;
}


function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -4 }}
      className="glass rounded-2xl p-6 group hover:border-white/20 transition-all"
    >
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--neon-cyan)]/20 to-[var(--neon-magenta)]/20 border border-white/10 flex items-center justify-center text-[var(--neon-cyan)] group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="mt-4 font-display font-semibold text-lg">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{body}</p>
    </motion.div>
  );
}

function DeckPreview({ label, track, bpm, hue, reverse }: { label: string; track: string; bpm: string; hue: string; reverse?: boolean }) {
  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        <span>{label}</span>
        <span style={{ color: `oklch(0.8 0.2 ${hue})` }}>● LIVE</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div
          className="relative w-14 h-14 rounded-full animate-spin-slow flex items-center justify-center"
          style={{ background: `conic-gradient(oklch(0.7 0.22 ${hue}), oklch(0.2 0.05 280), oklch(0.7 0.22 ${hue}))` }}
        >
          <div className="w-3 h-3 rounded-full bg-background" />
        </div>
        <div className="min-w-0">
          <div className="font-display font-semibold truncate">{track}</div>
          <div className="text-xs text-muted-foreground font-mono">{bpm} BPM</div>
        </div>
      </div>
      <div className={`mt-4 h-10 flex items-center gap-px ${reverse ? "flex-row-reverse" : ""}`}>
        {Array.from({ length: 60 }).map((_, i) => (
          <span key={i} className="flex-1 rounded-full" style={{
            height: `${30 + ((i * 53) % 70)}%`,
            background: `oklch(0.7 0.2 ${hue} / ${0.4 + ((i * 13) % 60) / 100})`,
          }} />
        ))}
      </div>
    </div>
  );
}
