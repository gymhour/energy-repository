import express from 'express';
import { claseMethods } from '../controllers/clase.Controller.js';
import { authenticateToken, isAdmin, isAdminOrEntrenador } from '../services/auth.service.js';
import upload from '../services/multer.service.js';

const claseRouter = express.Router();

claseRouter.get('/horario/', claseMethods.getAllClasesAndHorarioClases)
claseRouter.post("/:idClase/entrenador/:idEntrenador", authenticateToken, isAdmin, claseMethods.asignarEntrenadorAClase);
claseRouter.post('/horario/', authenticateToken, isAdmin, upload.single('image'), claseMethods.createClaseWithHorarios)
claseRouter.get('/horario/:id/turnos-activos', authenticateToken, isAdminOrEntrenador, claseMethods.getTurnosActivosByHorario);
claseRouter.get('/horario/:id/cupos', claseMethods.getHorarioCupos);
claseRouter.get('/horario/:id', claseMethods.getClaseById)
claseRouter.post('/horario/:id/modify', authenticateToken, isAdminOrEntrenador, claseMethods.modifyHorarioSingle);
claseRouter.put('/clase/:id', authenticateToken, isAdminOrEntrenador, upload.single('image'), claseMethods.updateClaseFields);
claseRouter.delete('/horario/:id', authenticateToken, isAdmin, claseMethods.deleteClaseWithHorarios)
claseRouter.delete("/:idClase/entrenador/:idEntrenador", authenticateToken, isAdmin, claseMethods.removeEntrenadorFromClase);
claseRouter.post('/:idClase/horarioClase', authenticateToken, isAdminOrEntrenador, claseMethods.createHorarioSingle);
claseRouter.delete('/horarioClase/:id', authenticateToken, isAdminOrEntrenador, claseMethods.deleteHorarioSingle);

export default claseRouter;