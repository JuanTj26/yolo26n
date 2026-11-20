export type PedestrianState = "normal" | "solicitado" | "cruzando" | "bloqueado";

export interface SolicitudPeatonal {
  id: string;
  zona: number;          // 0-based: 0=Zona1, 1=Zona2…
  hora: string;          // HH:MM:SS (hora local México)
  timestampInicio: number;
  segundosEspera: number;
  atendida: boolean;
  tidbId?: number;       // ID auto-increment devuelto por TiDB Cloud tras el INSERT
}

export const STORAGE_KEY_SOLICITUDES = "smarttraffic_solicitudes_peatonales";
