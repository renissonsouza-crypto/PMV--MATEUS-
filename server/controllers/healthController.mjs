import { checkPostgresHealth } from "../models/PostgresHealthModel.mjs";
export async function healthController(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido" });
  }
  try {
    const connected = await checkPostgresHealth();
    return res.status(connected ? 200 : 503).json({ status: connected ? "ok" : "error", database: connected ? "connected" : "disconnected", runtime: "vercel-postgres" });
  } catch (error) {
    return res.status(503).json({ status: "error", database: "disconnected", error: "Banco de dados indisponível" });
  }
}
