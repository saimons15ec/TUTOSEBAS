import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TUTOSEBAS · Plataforma UIC",
  description: "Fin de Carrera, Complexivos, trabajos UIC, cursos, Normas APA, pagos y revisiones.",
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
