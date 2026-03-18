import { fetchAllListItems, LIST_IDS } from "./_graph";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const select = "ID,field_1,field_2,field_3,field_5,field_6,field_7,field_8,field_9,field_10,field_11,field_12,field_13,UnidadMedida_IN,GramosUnidad_IN,EsReceta_IN";
    res.json(await fetchAllListItems(LIST_IDS.ingredientes, select, "fields/field_13 eq 'Activo'"));
  } catch (err) {
    console.error("/api/ingredientes error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
