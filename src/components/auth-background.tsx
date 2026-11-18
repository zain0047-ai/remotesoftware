/** Decorative gradient + grid background shared by the portal/login pages. */
export function AuthBackground() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-slate-400/15 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,107,92,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,107,92,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}
