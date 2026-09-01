import { createPostgresRegistration } from "../models/PostgresRegistrationModel.mjs";
import { validateRegistration } from "../models/validation.mjs";
export async function registrationController(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });
  const validation = validateRegistration(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });
  try {
    const id = await createPostgresRegistration(validation.data);
    return res.status(201).json({ id, message: "Cadastro realizado" });
  } catch (error) {
    if (error.code === "23505" || /unique/i.test(error.message)) return res.status(409).json({ error: "CPF ou e-mail já cadastrado" });
    return res.status(500).json({ error: "Erro ao realizar cadastro", detail: process.env.NODE_ENV === "development" ? error.message : undefined });
  }
}
