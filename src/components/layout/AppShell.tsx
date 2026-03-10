import BottomNav from "./BottomNav";
import ProfileBootstrap from "./ProfileBootstrap";
import ReviewReminderBridge from "./ReviewReminderBridge";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="editorial-shell min-h-dvh flex flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-80 bg-[radial-gradient(circle_at_top_left,rgba(56,112,255,0.22),transparent_42%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.32),transparent_28%)]" />
      <div className="pointer-events-none absolute -left-24 top-24 z-0 h-56 w-56 rounded-full bg-primary/12 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-52 z-0 h-48 w-48 rounded-full bg-sky-200/20 blur-3xl dark:bg-sky-400/8" />
      <ProfileBootstrap />
      <ReviewReminderBridge />
      <main className="relative z-10 flex-1 pb-20 pt-safe">{children}</main>
      <BottomNav />
    </div>
  );
}
