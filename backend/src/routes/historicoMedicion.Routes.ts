import { Router } from 'express';
import { historicoEjercicioMethods } from '../controllers/historicoEjercicio.Controller.js';
import { authenticateToken } from '../services/auth.service.js';

const historicoEjercicioRouter = Router();

historicoEjercicioRouter.post('/', authenticateToken, historicoEjercicioMethods.createHistoricoEjercicio);
historicoEjercicioRouter.get('/:id', authenticateToken, historicoEjercicioMethods.getHistoricoEjercicioById);
historicoEjercicioRouter.put('/:id', authenticateToken, historicoEjercicioMethods.updateHistoricoEjercicio);
historicoEjercicioRouter.delete('/:id', authenticateToken, historicoEjercicioMethods.deleteHistoricoEjercicio);

export default historicoEjercicioRouter;
