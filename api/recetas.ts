import { fetchAllListItems, LIST_IDS } from "./_graph.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const select = "ID,Receta_RE,KGTotal_RE,TamanoPorcion_RE,NroPorciones_RE,Status_RE";
    res.json(await fetchAllListItems(LIST_IDS.recetas, select, "fields/Status_RE eq 'Activo'"));
  } catch (err) {
    console.error("/api/recetas error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
