import express from 'express';
import { planMethods } from '../controllers/plan.Controller.js';
import { authenticateToken, isAdminOrRecepcion, isStaff } from '../services/auth.service.js';
//import upload from '../services/multer.service.js';

const planRouter = express.Router();

// Lectura: la necesita todo el staff para el alta de socios (elegir plan en el formulario).
// La gestión de planes (alta/edición/baja y sus precios) sigue siendo de admin y recepción.
planRouter.get('/usuario/:idUsuario', authenticateToken, isStaff, planMethods.getPlanById);
planRouter.get('/', authenticateToken, isStaff, planMethods.getAllPlans)
planRouter.post('/', authenticateToken, isAdminOrRecepcion, planMethods.createPlan)
planRouter.get('/:id', authenticateToken, isStaff, planMethods.getPlanById)
planRouter.put('/:id', authenticateToken, isAdminOrRecepcion, planMethods.updatePlan)
planRouter.delete('/:id', authenticateToken, isAdminOrRecepcion, planMethods.deletePlan)

export default planRouter;