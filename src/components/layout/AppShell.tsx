import BottomNav from "./BottomNav";
import ProfileBootstrap from "./ProfileBootstrap";
import ReviewReminderBridge from "./ReviewReminderBridge";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="editorial-shell min-h-dvh flex flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-96 bg-[radial-gradient(circle_at_top_left,rgba(42,88,223,0.22),transparent_44%),radial-gradient(circle_at_top_right,rgba(226,184,98,0.14),transparent_30%)]" />
      <div className="pointer-events-none absolute -left-24 top-24 z-0 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-44 z-0 h-56 w-56 rounded-full bg-amber-200/20 blur-3xl dark:bg-amber-300/8" />
      <ProfileBootstrap />
      <ReviewReminderBridge />
      <main
        className="relative z-10 flex-1 pt-safe"
        style={{ paddingBottom: "var(--bottom-nav-clearance)" }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
