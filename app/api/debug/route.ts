import { NextResponse } from "next/server";

export async function GET() {
  const u = process.env.DB_USER ?? "";
  const p = process.env.DB_PASSWORD ?? "";
  return NextResponse.json({
    user: u,
    userLen: u.length,
    userCharCodes: [...u].map((c) => c.charCodeAt(0)),
    passLen: p.length,
    passHasWhitespace: /\s/.test(p),
    passLastCharCode: p.charCodeAt(p.length - 1),
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    db: process.env.DB_NAME,
  });
}

