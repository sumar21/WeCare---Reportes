import express from "express";
import { createServer as createViteServer } from "vite";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { SITE_ID, fetchAllListItems, getGraphToken, getListIdByName, LIST_IDS } from "./api/_graph.js";

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

// ── Server ─────────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const PORT = 3000;
  const SESSION_COOKIE = "wecare_session";
  const SESSION_TTL_SECONDS = 60 * 60 * 12;

  type SessionUser = { concatlog: string; nombre: string };
  const sessions = new Map<string, SessionUser>();

  const normalize = (value: unknown) => String(value ?? "").trim();
  const normalizeKey = (value: unknown) => normalize(value).toLowerCase();

  const parseCookieHeader = (header: string | undefined): Record<string, string> => {
    if (!header) return {};
    return header.split(";").reduce<Record<string, string>>((acc, item) => {
      const [rawKey, ...rawValue] = item.trim().split("=");
      if (!rawKey) return acc;
      acc[rawKey] = decodeURIComponent(rawValue.join("="));
      return acc;
    }, {});
  };

  const readSession = (req: Request): SessionUser | null => {
    const cookies = parseCookieHeader(req.headers.cookie);
    const sessionId = cookies[SESSION_COOKIE];
    if (!sessionId) return null;
    return sessions.get(sessionId) ?? null;
  };

  const setSessionCookie = (res: Response, sessionId: string) => {
    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`
    );
  };

  const clearSessionCookie = (res: Response) => {
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  };

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const session = readSession(req);
    if (!session) {
      return res.status(401).json({ error: "No autenticado" });
    }
    (req as Request & { authUser?: SessionUser }).authUser = session;
    next();
  };

  const getFieldInsensitive = (fields: Record<string, unknown>, candidates: string[]): string => {
    for (const candidate of candidates) {
      if (candidate in fields) return normalize(fields[candidate]);
    }

    const map = new Map<string, string>();
    Object.keys(fields).forEach((key) => {
      map.set(key.toLowerCase(), key);
    });

    for (const candidate of candidates) {
      const foundKey = map.get(candidate.toLowerCase());
      if (foundKey) return normalize(fields[foundKey]);
    }

    return "";
  };

  const fetchAllListItemsFullFields = async (listId: string): Promise<any[]> => {
    const token = await getGraphToken();
    const items: any[] = [];
    let url: string | null =
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID()}/lists/${listId}/items?expand=fields&$top=999`;

    while (url) {
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
        },
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Graph API error ${resp.status}: ${err}`);
      }

      const data = (await resp.json()) as { value: any[]; "@odata.nextLink"?: string };
      items.push(...data.value.map((item) => item.fields));
      url = data["@odata.nextLink"] ?? null;
    }

    return items;
  };

  app.use(express.json());

  app.post("/api/auth/login", async (req, res) => {
    try {
      const concatlogInput = normalize(req.body?.concatlog);
      const passwordInput = normalize(req.body?.password);

      if (!concatlogInput || !passwordInput) {
        return res.status(400).json({ error: "Faltan concatlog o password" });
      }

      const usuariosListId = LIST_IDS.usuarios;
      const usuarios = await fetchAllListItemsFullFields(usuariosListId);

      const user = usuarios.find((fields: Record<string, unknown>) => {
        const concatlog = getFieldInsensitive(fields, ["UsuarioApp_Usr", "concatlog", "ConcatLog", "Title"]);
        const password = getFieldInsensitive(fields, ["Password_Usr", "password", "Password"]);
        const status = getFieldInsensitive(fields, ["Status_Usr", "Status_US", "Status", "status"]);

        if (status && normalizeKey(status) !== "activo") return false;
        return normalizeKey(concatlog) === normalizeKey(concatlogInput) && password === passwordInput;
      });

      if (!user) {
        return res.status(401).json({ error: "Usuario o contraseña inválidos" });
      }

      const concatlog = getFieldInsensitive(user, ["UsuarioApp_Usr", "concatlog", "ConcatLog", "Title"]);
      const nombre =
        getFieldInsensitive(user, ["ConcatName_Usr", "NombreCompleto", "Nombre_Usr", "DisplayName", "displayName"]) || concatlog;

      const sessionId = randomUUID();
      sessions.set(sessionId, { concatlog, nombre });
      setSessionCookie(res, sessionId);

      return res.json({ user: { concatlog, nombre } });
    } catch (err) {
      console.error("/api/auth/login error:", err);
      return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    const session = readSession(req);
    if (!session) {
      return res.status(401).json({ error: "No autenticado" });
    }
    return res.json({ user: session });
  });

  app.post("/api/auth/logout", (req, res) => {
    const cookies = parseCookieHeader(req.headers.cookie);
    const sessionId = cookies[SESSION_COOKIE];
    if (sessionId) sessions.delete(sessionId);
    clearSessionCookie(res);
    return res.json({ ok: true });
  });

  // GET /api/menus?estacion=...&dieta=...
  // GET /api/menus?mode=options
  app.get("/api/menus", requireAuth, async (req, res) => {
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
  });

  // GET /api/recetas
  app.get("/api/recetas", requireAuth, async (_req, res) => {
    try {
      const select = "ID,Receta_RE,KGTotal_RE,TamanoPorcion_RE,NroPorciones_RE,Status_RE";
      res.json(await fetchAllListItems(LIST_IDS.recetas, select, "fields/Status_RE eq 'Activo'"));
    } catch (err) {
      console.error("/api/recetas error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/ingredientes
  app.get("/api/ingredientes", requireAuth, async (_req, res) => {
    try {
      const select = "ID,field_1,field_2,field_3,field_5,field_6,field_7,field_8,field_9,field_10,field_11,field_12,field_13,UnidadMedida_IN,GramosUnidad_IN,EsReceta_IN";
      res.json(await fetchAllListItems(LIST_IDS.ingredientes, select, "fields/field_13 eq 'Activo'"));
    } catch (err) {
      console.error("/api/ingredientes error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/ingredientes-receta
  app.get("/api/ingredientes-receta", requireAuth, async (_req, res) => {
    try {
      const select = "ID,Receta_IR,Ingrediente,CantidadRecetaKG_IR,FactorCorrectivo_IR,UnidadMedida_IR,Status_IR";
      res.json(await fetchAllListItems(LIST_IDS.ingredientesReceta, select, "fields/Status_IR eq 'Activo'"));
    } catch (err) {
      console.error("/api/ingredientes-receta error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/planificaciones?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
  app.get("/api/planificaciones", requireAuth, async (req, res) => {
    try {
      const { fechaInicio, fechaFin } = req.query as { fechaInicio?: string; fechaFin?: string };
      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ error: "Se requieren fechaInicio y fechaFin (YYYY-MM-DD)" });
      }

      const start = new Date(`${fechaInicio}T00:00:00`);
      const end = new Date(`${fechaFin}T23:59:59`);

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

      // Nombres INTERNOS de SharePoint (Graph API ignora display names)
      const select = [
        "ID",
        "Fecha_GC",
        "FechaMesAno_GC",
        "Status_GC",
        "StatusCena_GC",
        // Almuerzo — internos (display entre paréntesis)
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
        // Acompañantes y personal extra
        "Acompa_x00f1_ante_GC",
        "PersonalExtra_GC",
        "InvitadoAlmuerzo_GC",
        "InvitadoCena_GC",
        // Status
        "StatusResidente_GC",
        "StatusPlanificacion13_GC",
      ].join(",");

      // Mapa interno → display para el frontend
      const FIELD_ALIASES: Record<string, string> = {
        Menu_GC:           "MenuAlmuerzo_GC",
        Entrada_GC:        "EntradaAlmuerzo_GC",
        PlatoPrincipal_GC: "PlatoPrincipalAlmuerzo_GC",
        Postre_GC:         "PostreAlmuerzo_GC",
        Paciente_GC:       "Residente_GC",
        "Acompa_x00f1_ante_GC": "Acompanante_GC",
      };

      const items = await fetchAllListItems(LIST_IDS.gestionComidas, select, filter);

      // Renombrar campos internos a display names
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
      res.json(filtered);
    } catch (err) {
      console.error("/api/planificaciones error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
