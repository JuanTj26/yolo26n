export type LightState = "green" | "yellow" | "red";

export type ControllerConfig = {
  minGreenMs: number;          // Tiempo mínimo en verde de una zona (5s)
  maxGreenMs: number;          // Tiempo máximo en verde antes de forzar cambio (20s)
  yellowMs: number;            // Duración del amarillo de precaución (2s)
  allRedMs: number;            // 1s de todo en rojo entre amarillo y el siguiente verde
  waitBonusIntervalMs: number; // Cada cuántos ms de espera en rojo se da un punto extra (5s)
  waitBonusPoints: number;     // Puntos de prioridad sumados por cada intervalo de espera
  rivalOvertakeFactor: number; // Factor para que un rival supere a la zona actual (1.5x)
};

export const DEFAULT_CONFIG: ControllerConfig = {
  minGreenMs: 5000,
  maxGreenMs: 20000,
  yellowMs: 2000,
  allRedMs: 1000,
  waitBonusIntervalMs: 5000,
  waitBonusPoints: 1,
  rivalOvertakeFactor: 1.5,
};

export class TrafficController {
  private zones: number;
  private cfg: ControllerConfig;
  private current = 0; // Zona que tiene (o tenía) el verde
  private next = 0;    // Zona que sigue después del ciclo de cambio
  private phase: "green" | "yellow" | "all-red" = "green";
  private phaseStart: number | null = null;

  // Marca de tiempo desde cuándo lleva cada zona esperando en rojo con >= 1 vehículo
  private redWaitSince: (number | null)[] = [];

  // Conjunto de índices de zonas bloqueadas forzosamente en rojo (ej. cruce peatonal activo)
  private blockedZones = new Set<number>();

  constructor(zones: number, cfg: Partial<ControllerConfig> = {}) {
    this.zones = zones;
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    this.redWaitSince = Array.from({ length: zones }, () => null);
  }

  /**
   * Bloquea o desbloquea una zona específica en rojo forzado.
   * Regla de seguridad: NUNCA permite que todas las zonas queden bloqueadas simultáneamente.
   * Retorna true si la operación fue exitosa, false si fue rechazada por seguridad.
   */
  blockZone(index: number, blocked: boolean): boolean {
    if (blocked) {
      if (this.zones > 1 && this.blockedZones.size >= this.zones - 1 && !this.blockedZones.has(index)) {
        console.warn(`[TrafficController] Rechazado bloqueo de zona ${index}: no se pueden bloquear todas las zonas a la vez.`);
        return false;
      }
      this.blockedZones.add(index);
      return true;
    } else {
      this.blockedZones.delete(index);
      return true;
    }
  }

  /**
   * Establece un listado de zonas bloqueadas asegurando que al menos 1 quede libre.
   */
  setBlockedZones(indices: number[]) {
    this.blockedZones.clear();
    for (const i of indices) {
      if (this.zones > 1 && this.blockedZones.size >= this.zones - 1) break;
      this.blockedZones.add(i);
    }
  }

  isZoneBlocked(index: number): boolean {
    return this.blockedZones.has(index);
  }

  /**
   * Retorna la fase actual interna ("green" | "yellow" | "all-red")
   */
  getCurrentPhase(): "green" | "yellow" | "all-red" {
    return this.phase;
  }

  /**
   * Retorna la zona activa actual
   */
  getCurrentZone(): number {
    return this.current;
  }

  /**
   * Llamar cada vez que haya un conteo nuevo. `now` en milisegundos (performance.now()).
   */
  update(counts: number[], now: number): LightState[] {
    if (this.zones === 0) return [];
    if (this.phaseStart === null) this.phaseStart = now;
    const elapsed = now - this.phaseStart;

    // Asegurar tamaño del array de tiempos de espera si cambiaron las zonas
    if (this.redWaitSince.length !== this.zones) {
      this.redWaitSince = Array.from({ length: this.zones }, () => null);
    }

    // 1. Actualizar tiempos de espera en rojo para evitar inanición (starvation)
    for (let i = 0; i < this.zones; i++) {
      const c = counts[i] ?? 0;
      const isRed = (i !== this.current) || (this.phase === "all-red");
      if (isRed && c > 0) {
        if (this.redWaitSince[i] === null) {
          this.redWaitSince[i] = now;
        }
      } else {
        this.redWaitSince[i] = null;
      }
    }

    // 2. Máquina de estados
    if (this.phase === "green") {
      // Calcular puntaje dinámico de los rivales (carros + bonus por tiempo de espera en rojo)
      let best = -1;
      let bestScore = -1;

      for (let i = 0; i < this.zones; i++) {
        if (i === this.current) continue;
        if (this.blockedZones.has(i)) continue; // Zona bloqueada NUNCA recibe verde

        const c = counts[i] ?? 0;
        let score = c;
        if (c > 0 && this.redWaitSince[i] !== null) {
          const waitMs = now - this.redWaitSince[i]!;
          const bonus = Math.floor(waitMs / this.cfg.waitBonusIntervalMs) * this.cfg.waitBonusPoints;
          score += bonus;
        }

        if (score > 0 && score > bestScore) {
          best = i;
          bestScore = score;
        }
      }

      const mine = counts[this.current] ?? 0;
      const currentBlocked = this.blockedZones.has(this.current);

      // Si la zona actual está bloqueada pero ningún rival tiene carros esperando,
      // buscamos la siguiente zona disponible no bloqueada para ceder el verde
      if (currentBlocked && best === -1) {
        for (let i = 0; i < this.zones; i++) {
          if (i !== this.current && !this.blockedZones.has(i)) {
            best = i;
            break;
          }
        }
      }

      const someoneWaiting = best !== -1;

      // Condiciones de cambio:
      // a) Zona actual bloqueada forzosamente por peatón:
      //    - Si mine === 0 (calle vacía): cambiar DE INMEDIATO a amarillo
      //    - Si mine > 0 (hay carros pasando): esperar al menos 5s de seguridad vehicular antes de amarillo
      // b) Alguien esperando y pasaron los 5s mínimos, y (la actual está vacía, o cumplió 20s, o rivalScore > mine * 1.5)
      const switchNow =
        (currentBlocked && (mine === 0 || elapsed >= this.cfg.minGreenMs)) ||
        (someoneWaiting &&
          elapsed >= this.cfg.minGreenMs &&
          (mine === 0 || elapsed >= this.cfg.maxGreenMs || bestScore > mine * this.cfg.rivalOvertakeFactor));

      if (switchNow) {
        this.phase = "yellow";
        this.next = best;
        this.phaseStart = now;
      }
    } else if (this.phase === "yellow") {
      // 3. Cuando termina el amarillo (2s), pasa a TODO EN ROJO (all-red de 1s)
      if (elapsed >= this.cfg.yellowMs) {
        this.phase = "all-red";
        this.phaseStart = now;
      }
    } else if (this.phase === "all-red") {
      // 4. Cuando termina el todo en rojo (1s), cede el verde a la zona seleccionada (si no está bloqueada)
      if (elapsed >= this.cfg.allRedMs) {
        let targetZone = this.next;
        if (targetZone === -1 || this.blockedZones.has(targetZone)) {
          // Buscar alguna zona no bloqueada
          let alt = -1;
          for (let i = 0; i < this.zones; i++) {
            if (!this.blockedZones.has(i)) {
              alt = i;
              break;
            }
          }
          targetZone = alt;
        }

        if (targetZone !== -1) {
          this.current = targetZone;
          this.phase = "green";
          this.phaseStart = now;
          this.redWaitSince[this.current] = null;
        } else {
          // Si no hay ninguna zona habilitada para verde, mantenerse en all-red
          this.phaseStart = now;
        }
      }
    }

    // 5. Generación de estados por zona:
    // En fase "all-red", TODAS las zonas están en rojo ("red").
    // En fase "green" o "yellow", ÚNICAMENTE la zona current tiene dicha luz; el resto SIEMPRE está en rojo.
    // Esto garantiza matemáticamente que jamás puede haber dos zonas en verde al mismo tiempo.
    if (this.phase === "all-red") {
      return Array.from({ length: this.zones }, (): LightState => "red");
    }

    return Array.from({ length: this.zones }, (_, i): LightState =>
      i === this.current ? (this.phase as LightState) : "red"
    );
  }
}
