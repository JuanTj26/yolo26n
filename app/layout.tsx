import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TECH TI — Sistema Inteligente de Tráfico y Aforo Vehicular",
  description: "Plataforma de monitoreo y control semafórico inteligente con IA y Gemelos Digitales 3D.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
