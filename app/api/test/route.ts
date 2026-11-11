import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export async function GET() {
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST?.trim(),
      port: Number(process.env.DB_PORT?.trim() ?? 4000),
      user: process.env.DB_USER?.trim(),
      password: process.env.DB_PASSWORD?.trim(),
      database: process.env.DB_NAME?.trim(),
      ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    });

    const [rows] = await conn.execute("SELECT NOW() AS ahora");
    return NextResponse.json({ ok: true, resultado: rows });
  } catch (err: unknown) {
    console.log("DEBUG", {
      userLen: process.env.DB_USER?.length,
      userEnd: JSON.stringify(process.env.DB_USER?.slice(-6)),
      passLen: process.env.DB_PASSWORD?.length,
      hostOk: process.env.DB_HOST === "gateway01.us-east-1.prod.aws.tidbcloud.com",
    });
    const mensaje = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  } finally {
    if (conn) await conn.end();
  }
}

