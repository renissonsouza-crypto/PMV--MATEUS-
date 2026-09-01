import { createPostgresTestimonial, listPostgresTestimonials } from "../models/PostgresTestimonialModel.mjs";
import { validateTestimonial } from "../models/validation.mjs";
export async function testimonialController(req, res) {
  try {
    if (req.method === "GET") return res.status(200).json(await listPostgresTestimonials());
    if (req.method === "POST") {
      const validation = validateTestimonial(req.body);
      if (validation.error) return res.status(400).json({ error: validation.error });
      return res.status(201).json(await createPostgresTestimonial(validation.data));
    }
    return res.status(405).json({ error: "Método não permitido" });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao acessar depoimentos", detail: process.env.NODE_ENV === "development" ? error.message : undefined });
  }
}
