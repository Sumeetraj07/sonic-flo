export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-50" />
      <div
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full animate-float-orb"
        style={{ background: "radial-gradient(circle, oklch(0.7 0.22 27 / 0.22), transparent 70%)" }}
      />
      <div
        className="absolute top-1/3 -right-40 w-[700px] h-[700px] rounded-full animate-float-orb"
        style={{ background: "radial-gradient(circle, oklch(0.7 0.18 35 / 0.18), transparent 70%)", animationDelay: "-6s" }}
      />
      <div
        className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full animate-float-orb"
        style={{ background: "radial-gradient(circle, oklch(0.85 0.02 70 / 0.5), transparent 70%)", animationDelay: "-12s" }}
      />
    </div>
  );
}
