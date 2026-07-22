import express from 'express';
import { planMethods } from '../controllers/plan.Controller.js';
import { authenticateToken, isAdmin } from '../services/auth.service.js';
//import upload from '../services/multer.service.js';

const planRouter = express.Router();

planRouter.get('/usuario/:idUsuario', authenticateToken, isAdmin, planMethods.getPlanById);
planRouter.get('/', authenticateToken, isAdmin, planMethods.getAllPlans)
planRouter.post('/', authenticateToken, isAdmin, planMethods.createPlan)
planRouter.get('/:id', authenticateToken, isAdmin, planMethods.getPlanById)
planRouter.put('/:id', authenticateToken, isAdmin, planMethods.updatePlan)
planRouter.delete('/:id', authenticateToken, isAdmin, planMethods.deletePlan)

export default planRouter;