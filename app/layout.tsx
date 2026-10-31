import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YOLO26n Vision — Detección Vehicular en Tiempo Real",
  description: "Sistema de detección inteligente de objetos con YOLO26n + ONNX Web.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
