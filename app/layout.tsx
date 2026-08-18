import type { Metadata } from "next";
import "./globals.css";
import "./trust-branding.css";

export const metadata: Metadata = {
  title: "Conecta Colombia — Solicitud Starlink",
  description: "Portal independiente de Conecta Colombia para solicitar conectividad en comunidades y servicios esenciales de Colombia.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
