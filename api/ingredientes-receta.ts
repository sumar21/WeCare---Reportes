import { fetchAllListItems, LIST_IDS } from "./_graph.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const select = "ID,Receta_IR,Ingrediente,CantidadRecetaKG_IR,FactorCorrectivo_IR,UnidadMedida_IR,Status_IR";
    res.json(await fetchAllListItems(LIST_IDS.ingredientesReceta, select, "fields/Status_IR eq 'Activo'"));
  } catch (err) {
    console.error("/api/ingredientes-receta error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
