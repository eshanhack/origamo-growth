import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Origami Growth - Dashboard",
  description: "Real-time startup growth dashboard",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0a] text-gray-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
