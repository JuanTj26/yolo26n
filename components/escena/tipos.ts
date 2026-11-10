import type { Sim } from "@/lib/traffic-sim";

export type DayMode = "day" | "sunset" | "night";

export interface SimRefHolder {
  current: Sim | null;
}

