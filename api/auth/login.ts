import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, signToken, setSessionCookie } from "./_session";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const concatlog = String(req.body?.concatlog ?? "").trim();
    const password = String(req.body?.password ?? "").trim();

    if (!concatlog || !password) {
      return res.status(400).json({ error: "Faltan concatlog o password" });
    }

    const user = await authenticateUser(concatlog, password);
    if (!user) {
      return res.status(401).json({ error: "Usuario o contraseña inválidos" });
    }

    const token = signToken({ concatlog: user.concatlog, nombre: user.nombre });
    setSessionCookie(res, token);

    return res.json({ user: { concatlog: user.concatlog, nombre: user.nombre } });
  } catch (err) {
    console.error("/api/auth/login error:", err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
