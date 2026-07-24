import express from 'express';
import { adminMethods } from '../controllers/admin.Controller.js';
import { authenticateToken, isAdmin, isAdminOrRecepcion } from '../services/auth.service.js';

const adminRouter = express.Router();

// El dashboard expone la información financiera del negocio (ingresos, gastos, ganancia neta):
// queda reservado al admin. El resto del área administrativa la comparte con recepción.
adminRouter.get('/dashboard', authenticateToken, isAdmin, adminMethods.getDashboardStats);
adminRouter.get('/churn-risk', authenticateToken, isAdminOrRecepcion, adminMethods.getChurnRisk);
adminRouter.post('/churn-risk/contact', authenticateToken, isAdminOrRecepcion, adminMethods.sendChurnContactEmail);

export default adminRouter;
