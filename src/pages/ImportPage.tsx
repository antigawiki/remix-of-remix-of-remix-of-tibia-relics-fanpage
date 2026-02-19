import { useState } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const BATCH_SIZE = 200;

function parseCSV(text: string, sep = ";") {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(sep).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === sep && !inQuotes) { cols.push(current); current = ""; }
      else { current += ch; }
    }
    cols.push(current);
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => { record[h] = (cols[idx] ?? "").trim(); });
    return record;
  });
}

async function sendBatch(table: string, rows: Record<string, string>[]) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/import-csv-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ table, rows }),
  });
  return res.json();
}

export default function ImportPage() {
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const addLog = (msg: string) => setLog((prev) => [...prev, msg]);

  const handleFile = async (table: "sessions" | "highscores", file: File) => {
    setRunning(true);
    const text = await file.text();
    const rows = parseCSV(text);
    addLog(`[${table}] ${rows.length} linhas lidas`);
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const result = await sendBatch(table, batch);
      if (result.error) {
        addLog(`[${table}] ERRO no lote ${i}-${i + batch.length}: ${result.error}`);
      } else {
        inserted += result.inserted ?? 0;
        addLog(`[${table}] Lote ${i + 1}-${i + batch.length} ✓ (total: ${inserted})`);
      }
    }
    addLog(`[${table}] CONCLUÍDO — ${inserted} registros importados`);
    setRunning(false);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-foreground">Importação de Dados</h1>

        <div className="space-y-6">
          <div className="border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-2 text-foreground">Sessões Online</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Selecione o arquivo <code>online_tracker_sessions-export-*.csv</code>
            </p>
            <input
              type="file"
              accept=".csv"
              disabled={running}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile("sessions", f);
              }}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
            />
          </div>

          <div className="border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-2 text-foreground">Highscore Snapshots</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Selecione o arquivo <code>highscore_snapshots-export-*.csv</code>
            </p>
            <input
              type="file"
              accept=".csv"
              disabled={running}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile("highscores", f);
              }}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
            />
          </div>
        </div>

        {log.length > 0 && (
          <div className="mt-6 bg-muted rounded-lg p-4 max-h-80 overflow-y-auto">
            {log.map((line, i) => (
              <div key={i} className="text-sm font-mono text-foreground">{line}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
