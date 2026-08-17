import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conecta Colombia — Solicitud Starlink",
  description: "Solicita conectividad Starlink para una comunidad o servicio esencial en Colombia.",
  other: {
    "codex-preview": "development",
  },
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
