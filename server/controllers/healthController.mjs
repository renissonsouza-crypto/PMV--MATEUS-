import { checkPostgresHealth } from "../models/PostgresHealthModel.mjs";
export async function healthController(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido" });
  try {
    const connected = await checkPostgresHealth();
    return res.status(200).json({ status: "ok", database: connected ? "connected" : "error", runtime: "vercel-postgres" });
  } catch (error) {
    return res.status(503).json({ status: "error", database: "disconnected", error: error.message });
  }
}
