import { createHmac } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getGraphToken, SITE_ID, LIST_IDS } from "../_graph.js";

const COOKIE_NAME = "wecare_session";
const TTL_SECONDS = 60 * 60 * 12; // 12 hours

function getSecret(): string {
  const s = process.env.SESSION_SECRET || process.env.GRAPH_CLIENT_SECRET || "wecare-fallback-secret-2026";
  return s;
}

/** Sign payload: base64(json).base64(hmac) */
export function signToken(payload: Record<string, unknown>): string {
  const data = { ...payload, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
  const json = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(json).digest("base64url");
  return `${json}.${sig}`;
}

/** Verify and return payload, or null */
export function verifyToken(token: string): Record<string, unknown> | null {
  const [json, sig] = token.split(".");
  if (!json || !sig) return null;
  const expected = createHmac("sha256", getSecret()).update(json).digest("base64url");
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(json, "base64url").toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((acc, item) => {
    const [rawKey, ...rawValue] = item.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join("="));
    return acc;
  }, {});
}

export function getSessionUser(req: VercelRequest): { concatlog: string; nombre: string } | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || !payload.concatlog) return null;
  return { concatlog: payload.concatlog as string, nombre: payload.nombre as string };
}

export function setSessionCookie(res: VercelResponse, token: string) {
  const isProduction = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
  const secure = isProduction ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL_SECONDS}${secure}`
  );
}

export function clearSessionCookie(res: VercelResponse) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

const normalize = (value: unknown) => String(value ?? "").trim();
const normalizeKey = (value: unknown) => normalize(value).toLowerCase();

function getFieldInsensitive(fields: Record<string, unknown>, candidates: string[]): string {
  for (const c of candidates) {
    if (c in fields) return normalize(fields[c]);
  }
  const map = new Map<string, string>();
  Object.keys(fields).forEach((key) => map.set(key.toLowerCase(), key));
  for (const c of candidates) {
    const found = map.get(c.toLowerCase());
    if (found) return normalize(fields[found]);
  }
  return "";
}

export async function authenticateUser(
  concatlogInput: string,
  passwordInput: string
): Promise<{ concatlog: string; nombre: string } | null> {
  const token = await getGraphToken();
  let url: string | null =
    `https://graph.microsoft.com/v1.0/sites/${SITE_ID()}/lists/${LIST_IDS.usuarios}/items?expand=fields&$top=999`;
  const items: any[] = [];

  while (url) {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly" },
    });
    if (!resp.ok) throw new Error(`Graph ${resp.status}`);
    const data = await resp.json();
    items.push(...data.value.map((i: any) => i.fields));
    url = data["@odata.nextLink"] ?? null;
  }

  const user = items.find((fields: Record<string, unknown>) => {
    const cl = getFieldInsensitive(fields, ["UsuarioApp_Usr", "concatlog", "ConcatLog", "Title"]);
    const pw = getFieldInsensitive(fields, ["Password_Usr", "password", "Password"]);
    const st = getFieldInsensitive(fields, ["Status_Usr", "Status_US", "Status", "status"]);
    if (st && normalizeKey(st) !== "activo") return false;
    return normalizeKey(cl) === normalizeKey(concatlogInput) && pw === passwordInput;
  });

  if (!user) return null;

  const concatlog = getFieldInsensitive(user, ["UsuarioApp_Usr", "concatlog", "ConcatLog", "Title"]);
  const nombre =
    getFieldInsensitive(user, ["ConcatName_Usr", "NombreCompleto", "Nombre_Usr", "DisplayName", "displayName"]) ||
    concatlog;

  return { concatlog, nombre };
}
