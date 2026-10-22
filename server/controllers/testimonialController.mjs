import { createPostgresTestimonial, listPostgresTestimonials } from "../models/PostgresTestimonialModel.mjs";
import { validateTestimonial } from "../models/validation.mjs";
import { validateJsonMutation } from "./requestSecurity.mjs";
import { digest } from "../services/enrollmentConfirmation.mjs";
const tokenPattern = /^[a-f0-9]{64}$/;
export async function testimonialController(req, res) {
  try {
    if (req.method === "GET") return res.status(200).json(await listPostgresTestimonials());
    if (req.method === "POST") {
      const requestError = validateJsonMutation(req);
      if (requestError) return res.status(requestError.status).json({ error: requestError.error });
      const validation = validateTestimonial(req.body);
      if (validation.error) return res.status(400).json({ error: validation.error });
      const profileToken = req.headers?.["x-profile-token"];
      if (!tokenPattern.test(profileToken)) return res.status(401).json({ error: "Entre na plataforma para publicar seu depoimento." });
      return res.status(201).json(await createPostgresTestimonial(validation.data, digest(profileToken)));
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Método não permitido" });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    return res.status(500).json({ error: "Erro ao acessar depoimentos", detail: process.env.NODE_ENV === "development" ? error.message : undefined });
  }
}
