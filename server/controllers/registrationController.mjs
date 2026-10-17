import { authCookie, registrationGoogleIntent, clearGoogleSignupCookie } from "../services/googleAuth.mjs";
import { postgresAuthRepository } from "../models/AuthRepository.mjs";
import { newToken, digest } from "../services/enrollmentConfirmation.mjs";
import { createPostgresRegistration } from "../models/PostgresRegistrationModel.mjs";
import { validateRegistration, validateVitoriaCep } from "../models/validation.mjs";
import { validateJsonMutation } from "./requestSecurity.mjs";
export async function registrationController(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }
  const requestError = validateJsonMutation(req);
  if (requestError) return res.status(requestError.status).json({ error: requestError.error });
  let googleIntent;
  try { googleIntent = await registrationGoogleIntent(req, postgresAuthRepository()); }
  catch (error) { return res.status(error.statusCode || 503).json({ error: error.statusCode ? error.message : 'Não foi possível validar o acesso Google.' }); }
  const validation = validateRegistration(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });
  const cepValidation = await validateVitoriaCep(validation.data.cep);
  if (cepValidation.unavailable) return res.status(503).json({ error: "Não foi possível validar o CEP agora. Tente novamente." });
  if (!cepValidation.valid) return res.status(400).json({ error: "O cadastro aceita somente CEPs de Vitória-ES" });
  try {
    const profileToken = newToken();
    const id = await createPostgresRegistration(validation.data, digest(profileToken), googleIntent?.tokenHash);
    res.setHeader("Cache-Control", "no-store");
    if (googleIntent) res.setHeader("Set-Cookie", [clearGoogleSignupCookie, authCookie("qv_session", profileToken, { secure: process.env.NODE_ENV === "production" || process.env.APP_BASE_URL?.startsWith("https://") }, 90 * 86400)]);
    return res.status(201).json({ id, profileToken, message: "Cadastro realizado" });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === "23505" || /unique/i.test(error.message)) return res.status(409).json({ error: "CPF ou e-mail já cadastrado" });
    return res.status(500).json({ error: "Erro ao realizar cadastro", detail: process.env.NODE_ENV === "development" ? error.message : undefined });
  }
}
