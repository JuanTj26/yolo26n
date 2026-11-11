"use client";

import { useState } from "react";

interface Resultado {
  ok: boolean;
  resultado?: { ahora: string }[];
  error?: string;
}

export default function PaginaDBTest() {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [cargando, setCargando] = useState(false);

  async function probarConexion() {
    setCargando(true);
    try {
      const res = await fetch("/api/test");
      const data: Resultado = await res.json();
      setResultado(data);
    } catch (err) {
      setResultado({ ok: false, error: String(err) });
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">🛢 Prueba de conexión TiDB Cloud</h1>

      <button
        onClick={probarConexion}
        disabled={cargando}
        className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-semibold transition"
      >
        {cargando ? "Conectando…" : "Probar conexión"}
      </button>

      {resultado && (
        <div
          className={`rounded-xl p-6 w-full max-w-lg text-sm font-mono ${
            resultado.ok ? "bg-green-900/40 border border-green-500" : "bg-red-900/40 border border-red-500"
          }`}
        >
          {resultado.ok ? (
            <>
              <p className="text-green-400 font-bold mb-2">✅ Conexión exitosa</p>
              <p>Hora del servidor:</p>
              <p className="text-green-300 text-lg mt-1">
                {resultado.resultado?.[0]?.ahora ?? "—"}
              </p>
            </>
          ) : (
            <>
              <p className="text-red-400 font-bold mb-2">❌ Error de conexión</p>
              <p className="text-red-300">{resultado.error}</p>
            </>
          )}
          <details className="mt-4 opacity-60">
            <summary className="cursor-pointer">JSON completo</summary>
            <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(resultado, null, 2)}</pre>
          </details>
        </div>
      )}

      <a href="/" className="text-sm text-gray-500 hover:text-gray-300 underline mt-4">
        ← Volver al dashboard
      </a>
    </main>
  );
}

