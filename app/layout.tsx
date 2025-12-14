import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import LogoutButton from "@/components/LogoutButton";
import SessionTimeout from "@/components/SessionTimeout";
import GoogleIcons from "@/components/GoogleIcons"; // Import new component

export const metadata: Metadata = {
  title: "Stock Management System",
  description: "Omnichannel Inventory Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased font-sans">
        <GoogleIcons /> 
        <Providers>
          {children}
          <LogoutButton />
          <SessionTimeout />
        </Providers>
      </body>
    </html>
  );
}
