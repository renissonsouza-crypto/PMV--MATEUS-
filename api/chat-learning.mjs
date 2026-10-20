import { getSql } from '../server/config/postgres.mjs';
import { chatLearningRepository } from '../server/models/ChatLearningRepository.mjs';
import { chatLearningController } from '../server/controllers/chatLearningController.mjs';

const repository = chatLearningRepository((statement, params = []) => getSql().query(statement, params));
export default chatLearningController(repository);
