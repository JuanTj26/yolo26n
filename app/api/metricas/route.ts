import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

async function obtenerConexion() {
  return await mysql.createConnection({
    host: process.env.DB_HOST?.trim(),
    port: Number(process.env.DB_PORT?.trim() ?? 4000),
    user: process.env.DB_USER?.trim(),
    password: process.env.DB_PASSWORD?.trim(),
    database: process.env.DB_NAME?.trim(),
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  });
}

// Inicializa la tabla en TiDB si no existe
async function asegurarTabla(conn: mysql.Connection) {
  const query = `
    CREATE TABLE IF NOT EXISTS metricas_trafico (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      camara VARCHAR(50) DEFAULT 'general',
      vehiculos INT DEFAULT 0,
      peatones INT DEFAULT 0,
      total_espera INT DEFAULT 0,
      nivel_congestion VARCHAR(20) DEFAULT 'Bajo',
      flujo_porcentaje INT DEFAULT 0,
      fps_promedio FLOAT DEFAULT 0.0
    );
  `;
  await conn.execute(query);
}

// READ (GET): Consultar métricas (últimas 100)
export async function GET() {
  let conn: mysql.Connection | null = null;
  try {
    conn = await obtenerConexion();
    await asegurarTabla(conn);

    const [filas] = await conn.execute(
      "SELECT * FROM metricas_trafico ORDER BY id DESC LIMIT 100"
    );
    return NextResponse.json({ ok: true, datos: filas });
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al consultar TiDB";
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  } finally {
    if (conn) await conn.end();
  }
}

// Helper para obtener fecha y hora exacta en zona horaria de México (America/Mexico_City)
function obtenerFechaHoraMexico(): string {
  const ahora = new Date();
  const formato = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  // Retorna "YYYY-MM-DD HH:MM:SS"
  return formato.format(ahora).replace(",", "");
}

// CREATE (POST): Guardar una nueva medición
export async function POST(req: Request) {
  let conn: mysql.Connection | null = null;
  try {
    const body = await req.json();
    const {
      camara = "general",
      vehiculos = 0,
      peatones = 0,
      total_espera = 0,
      nivel_congestion = "Bajo",
      flujo_porcentaje = 0,
      fps_promedio = 0,
    } = body;

    conn = await obtenerConexion();
    await asegurarTabla(conn);

    const fechaHoraMexico = obtenerFechaHoraMexico();

    const insertSql = `
      INSERT INTO metricas_trafico (fecha_hora, camara, vehiculos, peatones, total_espera, nivel_congestion, flujo_porcentaje, fps_promedio)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [resultado] = await conn.execute(insertSql, [
      fechaHoraMexico,
      camara,
      Number(vehiculos) || 0,
      Number(peatones) || 0,
      Number(total_espera) || 0,
      nivel_congestion,
      Number(flujo_porcentaje) || 0,
      Number(fps_promedio) || 0,
    ]);

    return NextResponse.json({ ok: true, resultado });
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al guardar en TiDB";
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  } finally {
    if (conn) await conn.end();
  }
}

// UPDATE (PUT): Editar un registro existente por ID
export async function PUT(req: Request) {
  let conn: mysql.Connection | null = null;
  try {
    const body = await req.json();
    const {
      id,
      camara,
      vehiculos,
      peatones,
      total_espera,
      nivel_congestion,
      flujo_porcentaje,
    } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID requerido para actualizar" }, { status: 400 });
    }

    conn = await obtenerConexion();

    const updateSql = `
      UPDATE metricas_trafico
      SET camara = COALESCE(?, camara),
          vehiculos = COALESCE(?, vehiculos),
          peatones = COALESCE(?, peatones),
          total_espera = COALESCE(?, total_espera),
          nivel_congestion = COALESCE(?, nivel_congestion),
          flujo_porcentaje = COALESCE(?, flujo_porcentaje)
      WHERE id = ?
    `;

    await conn.execute(updateSql, [
      camara ?? null,
      vehiculos !== undefined ? Number(vehiculos) : null,
      peatones !== undefined ? Number(peatones) : null,
      total_espera !== undefined ? Number(total_espera) : null,
      nivel_congestion ?? null,
      flujo_porcentaje !== undefined ? Number(flujo_porcentaje) : null,
      Number(id),
    ]);

    return NextResponse.json({ ok: true, mensaje: "Métrica actualizada con éxito" });
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al actualizar en TiDB";
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  } finally {
    if (conn) await conn.end();
  }
}

// DELETE (DELETE): Borrar un registro o limpiar todo
export async function DELETE(req: Request) {
  let conn: mysql.Connection | null = null;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const limpiarTodo = searchParams.get("todo");

    conn = await obtenerConexion();

    if (limpiarTodo === "true") {
      await conn.execute("TRUNCATE TABLE metricas_trafico");
      return NextResponse.json({ ok: true, mensaje: "Historial limpiado completamente" });
    }

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID requerido para eliminar" }, { status: 400 });
    }

    await conn.execute("DELETE FROM metricas_trafico WHERE id = ?", [Number(id)]);
    return NextResponse.json({ ok: true, mensaje: `Métrica con ID ${id} eliminada` });
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al eliminar en TiDB";
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  } finally {
    if (conn) await conn.end();
  }
}
