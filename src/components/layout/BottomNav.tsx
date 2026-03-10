"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Library, RotateCcw, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/read", label: "Read", icon: BookOpen },
  { href: "/vocabulary", label: "Words", icon: Library },
  { href: "/review", label: "Review", icon: RotateCcw },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    const loadDueCount = async () => {
      const supabase = createClient();
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { count } = await supabase
        .from("review_states")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .lte("next_review_at", new Date().toISOString());

      setDueCount(count ?? 0);
    };

    void loadDueCount();
  }, [pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm pb-safe">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-xs transition-colors ${
                isActive
                  ? "text-primary font-medium"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span className="relative">
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                {href === "/review" && dueCount > 0 && (
                  <span className="absolute -right-2 -top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                    {dueCount > 9 ? "9+" : dueCount}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
