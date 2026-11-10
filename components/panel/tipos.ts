export type EstadoTrafico = {
  detected: number;
  onScreen: number;
  queues: number[];
  green: "NS" | "EW";
  yellow: boolean;
  allRed: boolean;
  flow: number;
  hist: number[];
  pedestrians: number;
  pedestriansWaiting: number;
  pedestrianGreen: boolean;
};

export type ModoVista = "perspective" | "overhead" | "camera" | "neza";
export type ModoDia = "day" | "sunset" | "night";

