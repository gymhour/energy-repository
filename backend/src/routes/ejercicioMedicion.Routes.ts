import { Router } from 'express';
import { ejercicioMedicionMethods } from '../controllers/ejercicioMedicion.Controller.js';
import { authenticateToken } from '../services/auth.service.js';

const ejercicioMedicionRouter = Router();

ejercicioMedicionRouter.get('/usuario/:idUsuario', authenticateToken, ejercicioMedicionMethods.getEjerciciosMedicionByUsuario);
ejercicioMedicionRouter.post('/', authenticateToken, ejercicioMedicionMethods.createEjercicioMedicion);
ejercicioMedicionRouter.get('/', authenticateToken, ejercicioMedicionMethods.getAllEjerciciosMedicion);
ejercicioMedicionRouter.get('/:id', authenticateToken, ejercicioMedicionMethods.getEjercicioMedicionById);
ejercicioMedicionRouter.get('/max/:id', authenticateToken, ejercicioMedicionMethods.getMaxCantidadByEjercicioMedicion);
ejercicioMedicionRouter.put('/:id', authenticateToken, ejercicioMedicionMethods.updateEjercicioMedicion);
ejercicioMedicionRouter.delete('/:id', authenticateToken, ejercicioMedicionMethods.deleteEjercicioMedicion);

export default ejercicioMedicionRouter;
