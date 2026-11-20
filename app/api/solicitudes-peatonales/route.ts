import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const DB_CONFIG = {
  host: process.env.DB_HOST?.trim() || "gateway01.us-east-1.prod.aws.tidbcloud.com",
  port: Number(process.env.DB_PORT?.trim() || 4000),
  user: process.env.DB_USER?.trim() || "3DVC414qKbaiDev.root",
  password: process.env.DB_PASSWORD?.trim() || "YWulvpW3okvYAE8B",
  database: process.env.DB_NAME?.trim() || "smart_traffic",
};

async function obtenerConexion() {
  try {
    return await mysql.createConnection({
      ...DB_CONFIG,
      ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
      connectTimeout: 10000,
    });
  } catch (errStrict) {
    console.warn("Fallo conexion estricta TiDB, reintentando con SSL permisivo:", errStrict);
    return await mysql.createConnection({
      ...DB_CONFIG,
      ssl: { minVersion: "TLSv1.2", rejectUnauthorized: false },
      connectTimeout: 10000,
    });
  }
}

// Auto-crea la tabla si no existe (solo como respaldo, la tabla ya existe en TiDB)
async function asegurarTabla(conn: mysql.Connection) {
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS solicitudes_peatonales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        zona INT NOT NULL DEFAULT 0,
        zona_nombre VARCHAR(20) DEFAULT 'Zona 1',
        hora_solicitud VARCHAR(20) NOT NULL DEFAULT '00:00:00',
        segundos_espera INT DEFAULT 0,
        atendida TINYINT(1) DEFAULT 0
      )
    `);
  } catch (_e) {
    // Si falla la creacion (tabla ya existe con otro schema), continuar igual
  }
}

function obtenerFechaHoraMexico(): string {
  const ahora = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  return fmt.format(ahora).replace(",", "");
}

// GET: últimas 200 solicitudes
export async function GET() {
  let conn: mysql.Connection | null = null;
  try {
    conn = await obtenerConexion();
    const [filas] = await conn.execute(
      "SELECT * FROM solicitudes_peatonales ORDER BY id DESC LIMIT 200"
    );
    return NextResponse.json({ ok: true, datos: filas });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error TiDB";
    console.error("[solicitudes-peatonales GET]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  } finally {
    if (conn) await conn.end();
  }
}

// POST: registrar nueva solicitud de cruce
export async function POST(req: Request) {
  let conn: mysql.Connection | null = null;
  try {
    const body = await req.json();
    const {
      zona = 0,
      hora_solicitud = "",
      segundos_espera = 0,
      atendida = false,
    } = body;

    const zonaNum = Number(zona) || 0;
    const zonaNombre = `Zona ${zonaNum + 1}`;

    conn = await obtenerConexion();

    const fechaHora = obtenerFechaHoraMexico();
    // Truncar hora_solicitud a 12 chars (limite del VARCHAR(12) en TiDB)
    // toLocaleTimeString en es-MX puede generar "2:18:17 a. m." (14 chars)
    const horaRaw = (hora_solicitud && String(hora_solicitud).trim()) || fechaHora.slice(11, 19);
    const horaFinal = horaRaw.slice(0, 12);

    const [resultado] = await conn.execute(
      `INSERT INTO solicitudes_peatonales
        (fecha_hora, zona, zona_nombre, hora_solicitud, segundos_espera, atendida)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        fechaHora,
        zonaNum,
        zonaNombre,
        horaFinal,
        Number(segundos_espera) || 0,
        atendida ? 1 : 0,
      ]
    );

    return NextResponse.json({ ok: true, resultado });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error TiDB";
    console.error("[solicitudes-peatonales POST]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  } finally {
    if (conn) await conn.end();
  }
}

// PATCH: marcar solicitud como atendida y actualizar segundos de espera
export async function PATCH(req: Request) {
  let conn: mysql.Connection | null = null;
  try {
    const body = await req.json();
    const { id, segundos_espera, atendida } = body;
    if (!id) return NextResponse.json({ ok: false, error: "ID requerido" }, { status: 400 });

    conn = await obtenerConexion();
    await conn.execute(
      `UPDATE solicitudes_peatonales
       SET atendida = ?, segundos_espera = ?
       WHERE id = ?`,
      [atendida ? 1 : 0, Number(segundos_espera) || 0, Number(id)]
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error TiDB";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  } finally {
    if (conn) await conn.end();
  }
}

// DELETE: limpiar historial completo
export async function DELETE() {
  let conn: mysql.Connection | null = null;
  try {
    conn = await obtenerConexion();
    await conn.execute("TRUNCATE TABLE solicitudes_peatonales");
    return NextResponse.json({ ok: true, mensaje: "Historial peatonal limpiado" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error TiDB";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  } finally {
    if (conn) await conn.end();
  }
}
