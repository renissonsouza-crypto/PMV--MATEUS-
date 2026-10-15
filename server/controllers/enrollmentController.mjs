import { validateJsonMutation } from './requestSecurity.mjs';
import { enrollmentService } from '../services/enrollmentConfirmation.mjs';
import { postgresEnrollmentRepository } from '../models/PostgresEnrollmentRepository.mjs';
export function enrollmentController(repository = postgresEnrollmentRepository()) {
  const service = enrollmentService(repository);
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método não permitido' }); }
    const error = validateJsonMutation(req);
    if (error) return res.status(error.status).json({ error: error.error });
    try {
      const action = req.body?.action;
      let result;
      if (action === 'request') result = await service.request(req.body);
      else if (action === 'confirm') result = await service.confirm(req.body);
      else if (action === 'status') result = await service.status(req.body);
      else if (action === 'cancel') result = await service.cancel(req.body, req.headers['x-profile-token']);
      else return res.status(400).json({ error: 'Operação inválida' });
      return res.status(action === 'request' ? 202 : 200).json(result);
    } catch (failure) {
      return res.status(failure.statusCode || 500).json({ error: failure.statusCode ? failure.message : 'Não foi possível processar a inscrição. Tente novamente.' });
    }
  };
}
