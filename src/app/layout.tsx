import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { UserSettingsProvider } from "@/components/layout/UserSettingsProvider";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { createClient } from "@/lib/supabase/server";
import { USER_SETTINGS_SELECT } from "@/lib/user-settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WordReader",
  description: "Learn English by reading real news articles",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WordReader",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const initialSettings = user
    ? (
        await supabase
          .from("user_settings")
          .select(USER_SETTINGS_SELECT)
          .eq("user_id", user.id)
          .maybeSingle()
      ).data
    : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UserSettingsProvider initialSettings={initialSettings}>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </UserSettingsProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js');
              }
              if (window.navigator.standalone) {
                document.documentElement.classList.add('standalone');
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
