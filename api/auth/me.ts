import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSessionUser } from "./_session.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "No autenticado" });
  }
  return res.json({ user });
}
