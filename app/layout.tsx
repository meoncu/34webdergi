import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Altınoluk Dijital Arşivi",
  description: "Modern, güvenli ve hızlı dergi/makale arşiv uygulaması.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent", // Notch alanını daha iyi kullanır
    title: "Altınoluk",
  },
  icons: {
    apple: [
      { url: "https://ui-avatars.com/api/?name=A&background=8b5cf6&color=fff&size=180&bold=true", sizes: "180x180", type: "image/png" }
    ],
  }
};

export const viewport: Viewport = {
  themeColor: "#8b5cf6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={`${inter.variable} antialiased bg-slate-50/50`}>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-4 pt-20 lg:pt-8 md:p-8 overflow-y-auto">
            {children}
          </main>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('SW registration successful');
                    },
                    function(err) {
                      console.log('SW registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
