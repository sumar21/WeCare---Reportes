import { fetchAllListItems, LIST_IDS } from "./_graph.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();
  try {
    const { mode, estacion, dieta } = req.query as { mode?: string; estacion?: string; dieta?: string };

    if (mode === "options") {
      const selectOptions = "Tipo_MP,Estacion_MP,Status_MP";
      const items = await fetchAllListItems(LIST_IDS.menus, selectOptions, "fields/Status_MP eq 'Activo'");

      const estaciones = Array.from(
        new Set(
          items
            .map((item: any) => String(item.Estacion_MP ?? "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

      const dietas = Array.from(
        new Set(
          items
            .map((item: any) => String(item.Tipo_MP ?? "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

      return res.json({ estaciones, dietas });
    }

    const select = "ID,Lista_MP,ConcatEstacioNum_MP,Almuerzo_MP,Cena_MP,Tipo_MP,Estacion_MP,Status_MP";
    const filters: string[] = ["fields/Status_MP eq 'Activo'"];
    if (estacion) filters.push(`fields/Estacion_MP eq '${estacion}'`);
    if (dieta)    filters.push(`fields/Tipo_MP eq '${dieta}'`);
    const items = await fetchAllListItems(LIST_IDS.menus, select, filters.join(" and "));
    res.json(items);
  } catch (err) {
    console.error("/api/menus error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
