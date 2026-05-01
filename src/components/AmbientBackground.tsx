export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full animate-float-orb"
        style={{ background: "radial-gradient(circle, oklch(0.7 0.25 195 / 0.35), transparent 70%)" }}
      />
      <div
        className="absolute top-1/3 -right-40 w-[700px] h-[700px] rounded-full animate-float-orb"
        style={{ background: "radial-gradient(circle, oklch(0.7 0.27 330 / 0.3), transparent 70%)", animationDelay: "-6s" }}
      />
      <div
        className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full animate-float-orb"
        style={{ background: "radial-gradient(circle, oklch(0.65 0.25 295 / 0.25), transparent 70%)", animationDelay: "-12s" }}
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 0%, oklch(0.13 0.02 280 / 0.4) 100%)" }} />
    </div>
  );
}
