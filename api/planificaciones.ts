import { fetchAllListItems, LIST_IDS } from "./_graph";
import type { VercelRequest, VercelResponse } from "@vercel/node";

function parseFechaGC(value: string): Date | null {
  const raw = String(value || "").trim();
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!dmy) return null;

  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  const year = Number(dmy[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

// Mapa interno → display para campos donde el nombre interno difiere del display
const FIELD_ALIASES: Record<string, string> = {
  Menu_GC:           "MenuAlmuerzo_GC",
  Entrada_GC:        "EntradaAlmuerzo_GC",
  PlatoPrincipal_GC: "PlatoPrincipalAlmuerzo_GC",
  Postre_GC:         "PostreAlmuerzo_GC",
  Paciente_GC:       "Residente_GC",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    const { fechaInicio, fechaFin } = req.query as {
      fechaInicio?: string;
      fechaFin?: string;
    };

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: "Se requieren fechaInicio y fechaFin (formato ISO: YYYY-MM-DD)" });
    }

    const start = new Date(`${fechaInicio}T00:00:00`);
    const end   = new Date(`${fechaFin}T23:59:59`);

    const monthYears = new Set<string>();
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= endMonth) {
      const mm = String(cur.getMonth() + 1).padStart(2, "0");
      monthYears.add(`${mm}/${cur.getFullYear()}`);
      cur.setMonth(cur.getMonth() + 1);
    }

    const monthFilter = Array.from(monthYears)
      .map((my) => `fields/FechaMesAno_GC eq '${my}'`)
      .join(" or ");

    const filter = [
      `(${monthFilter})`,
      "fields/StatusPlanificacion13_GC eq 'Activo'",
      "fields/StatusResidente_GC eq 'Activo'",
    ].join(" and ");

    // Usar nombres INTERNOS de SharePoint (Graph API ignora display names)
    const select = [
      "ID",
      "Fecha_GC",
      "FechaMesAno_GC",
      "Status_GC",
      "StatusCena_GC",
      // Almuerzo — nombres internos (display names entre paréntesis)
      "Menu_GC",               // (MenuAlmuerzo_GC)
      "Entrada_GC",            // (EntradaAlmuerzo_GC)
      "PlatoPrincipal_GC",     // (PlatoPrincipalAlmuerzo_GC)
      "GuarnicionAlmuerzo_GC",
      "SalsaAlmuerzo_GC",
      "Postre_GC",             // (PostreAlmuerzo_GC)
      // Cena
      "MenuCena_GC",
      "EntradaCena_GC",
      "PrincipalCena_GC",
      "GuarnicionCena_GC",
      "SalsaCena_GC",
      "PostreCena_GC",
      // Metadata
      "TipoMenu_GC",
      "ListaMenu_GC",
      "Paciente_GC",           // (Residente_GC)
      "IDResidente_GC",
      // Status
      "StatusResidente_GC",
      "StatusPlanificacion13_GC",
    ].join(",");

    const items = await fetchAllListItems(LIST_IDS.gestionComidas, select, filter);

    console.log("[API planificaciones v3] items fetched:", items.length);

    // Renombrar campos internos a display names para el frontend
    const renamed = items.map((item: any) => {
      const out: any = { ...item };
      for (const [internal, display] of Object.entries(FIELD_ALIASES)) {
        if (internal in out) {
          out[display] = out[internal];
          delete out[internal];
        }
      }
      return out;
    });

    const filtered = renamed.filter((item: any) => {
      const fecha = parseFechaGC(item.Fecha_GC);
      return !!fecha && fecha >= start && fecha <= end;
    });
    console.log("[API planificaciones v3] filtered:", filtered.length, "keys:", filtered[0] ? Object.keys(filtered[0]).filter((k: string) => !k.startsWith('@')).join(',') : 'none');
    res.json(filtered);
  } catch (err) {
    console.error("/api/planificaciones error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
