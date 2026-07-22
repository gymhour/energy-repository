import express from 'express';
import { rutinaMethods } from '../controllers/rutina.Controller.js';
import { authenticateToken, isAdminOrEntrenador } from '../services/auth.service.js';

const rutinaRouter = express.Router();
// 1) Rutas específicas primero:
rutinaRouter.get('/entrenador/:idEntrenador', authenticateToken, isAdminOrEntrenador, rutinaMethods.getRutinasByEntrenador);
rutinaRouter.get('/usuario/:idUsuario', authenticateToken, rutinaMethods.getRutinasByUsuario);
rutinaRouter.get('/dia/:dayOfWeek', authenticateToken, rutinaMethods.getRutinasByDayOfWeek);
rutinaRouter.get('/admins/', authenticateToken, rutinaMethods.getRutinasByAdmins);
rutinaRouter.get('/asignadas', authenticateToken, isAdminOrEntrenador, rutinaMethods.getRutinasAsignadas);

// 2) Luego las genéricas
rutinaRouter.get('/', authenticateToken, isAdminOrEntrenador, rutinaMethods.getAllRutinasWithDetails);
rutinaRouter.post('/simple', authenticateToken, isAdminOrEntrenador, rutinaMethods.createRutinaSimple);
rutinaRouter.post('/', authenticateToken, isAdminOrEntrenador, rutinaMethods.createRutinaWithBlocks);
rutinaRouter.get('/:id', authenticateToken, rutinaMethods.getRutinaById);
rutinaRouter.put('/:id', authenticateToken, isAdminOrEntrenador, rutinaMethods.updateRutinaWithBlocks);
rutinaRouter.delete('/:id', authenticateToken, isAdminOrEntrenador, rutinaMethods.deleteRutinaWithBlocks);

export default rutinaRouter;