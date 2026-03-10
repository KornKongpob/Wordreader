import BottomNav from "./BottomNav";
import ReviewReminderBridge from "./ReviewReminderBridge";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <ReviewReminderBridge />
      <main className="flex-1 pb-16 pt-safe">{children}</main>
      <BottomNav />
    </div>
  );
}
