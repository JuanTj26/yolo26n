import ModernTrafficDashboard from "@/components/ModernTrafficDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tráfico Inteligente — YOLO26n 3D Dashboard",
  description: "Monitoreo y optimización de tráfico en tiempo real con YOLO26n y simulación 3D adaptativa.",
};

export default function DashboardPage() {
  return <ModernTrafficDashboard />;
}

