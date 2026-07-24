import express from 'express';
import { ejercicioMethods } from '../controllers/ejercicio.Controller.js';
import { authenticateToken, isStaff } from '../services/auth.service.js';
import upload from '../services/multer.service.js';

const ejercicioRouter = express.Router();

// Todas protegidas: requiere JWT
ejercicioRouter.use(authenticateToken);

ejercicioRouter.post('/', authenticateToken, isStaff, upload.single('imagen'), ejercicioMethods.createEjercicio);
ejercicioRouter.get('/', ejercicioMethods.getAllEjercicios);
ejercicioRouter.get('/:id', ejercicioMethods.getEjercicioById);
ejercicioRouter.put('/:id', authenticateToken, isStaff, upload.single('imagen'), ejercicioMethods.updateEjercicio);
ejercicioRouter.delete('/:id', authenticateToken, isStaff, ejercicioMethods.deleteEjercicio);

export default ejercicioRouter;
