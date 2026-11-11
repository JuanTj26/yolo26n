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

// GET: Consultar el historial de métricas
export async function GET() {
  let conn: mysql.Connection | null = null;
  try {
    conn = await obtenerConexion();
    await asegurarTabla(conn);

    const [filas] = await conn.execute(
      "SELECT * FROM metricas_trafico ORDER BY id DESC LIMIT 50"
    );
    return NextResponse.json({ ok: true, datos: filas });
  } catch (err: unknown) {
    console.log("DEBUG", {
      userLen: process.env.DB_USER?.length,
      userEnd: JSON.stringify(process.env.DB_USER?.slice(-6)),
      passLen: process.env.DB_PASSWORD?.length,
      hostOk: process.env.DB_HOST === "gateway01.us-east-1.prod.aws.tidbcloud.com",
    });
    const mensaje = err instanceof Error ? err.message : "Error al consultar TiDB";
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  } finally {
    if (conn) await conn.end();
  }
}

// POST: Guardar una nueva lectura de la cámara
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

    const insertSql = `
      INSERT INTO metricas_trafico (camara, vehiculos, peatones, total_espera, nivel_congestion, flujo_porcentaje, fps_promedio)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [resultado] = await conn.execute(insertSql, [
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
    console.log("DEBUG", {
      userLen: process.env.DB_USER?.length,
      userEnd: JSON.stringify(process.env.DB_USER?.slice(-6)),
      passLen: process.env.DB_PASSWORD?.length,
      hostOk: process.env.DB_HOST === "gateway01.us-east-1.prod.aws.tidbcloud.com",
    });
    const mensaje = err instanceof Error ? err.message : "Error al guardar en TiDB";
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  } finally {
    if (conn) await conn.end();
  }
}

