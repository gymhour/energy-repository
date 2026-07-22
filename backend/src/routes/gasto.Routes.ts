import express from 'express';
import { gastoMethods } from '../controllers/gasto.Controller.js';
import { authenticateToken, isAdmin } from '../services/auth.service.js';

const gastoRouter = express.Router();

gastoRouter.get('/', authenticateToken, isAdmin, gastoMethods.getAllGastos);
gastoRouter.post('/', authenticateToken, isAdmin, gastoMethods.createGasto);
gastoRouter.put('/:id', authenticateToken, isAdmin, gastoMethods.updateGasto);
gastoRouter.delete('/:id', authenticateToken, isAdmin, gastoMethods.deleteGasto);

export default gastoRouter;
