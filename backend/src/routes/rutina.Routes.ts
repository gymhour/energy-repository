import express from 'express';
import { rutinaMethods } from '../controllers/rutina.Controller.js';
import { authenticateToken, isStaff } from '../services/auth.service.js';

const rutinaRouter = express.Router();
// 1) Rutas específicas primero:
rutinaRouter.get('/entrenador/:idEntrenador', authenticateToken, isStaff, rutinaMethods.getRutinasByEntrenador);
rutinaRouter.get('/usuario/:idUsuario', authenticateToken, rutinaMethods.getRutinasByUsuario);
rutinaRouter.get('/dia/:dayOfWeek', authenticateToken, rutinaMethods.getRutinasByDayOfWeek);
rutinaRouter.get('/admins/', authenticateToken, rutinaMethods.getRutinasByAdmins);
rutinaRouter.get('/asignadas', authenticateToken, isStaff, rutinaMethods.getRutinasAsignadas);

// 2) Luego las genéricas
rutinaRouter.get('/', authenticateToken, isStaff, rutinaMethods.getAllRutinasWithDetails);
rutinaRouter.post('/simple', authenticateToken, isStaff, rutinaMethods.createRutinaSimple);
rutinaRouter.post('/', authenticateToken, isStaff, rutinaMethods.createRutinaWithBlocks);
rutinaRouter.get('/:id', authenticateToken, rutinaMethods.getRutinaById);
rutinaRouter.put('/:id', authenticateToken, isStaff, rutinaMethods.updateRutinaWithBlocks);
rutinaRouter.delete('/:id', authenticateToken, isStaff, rutinaMethods.deleteRutinaWithBlocks);

export default rutinaRouter;