import express from 'express';
import { userMethods } from '../controllers/user.Controller.js';
import { authServices } from '../services/auth.service.js';
import upload from '../services/multer.service.js';

const userRouter = express.Router();


userRouter.put("/estado/:id", authServices.authenticateToken, authServices.isStaff, userMethods.estadoUser);
userRouter.get('/', authServices.authenticateToken, authServices.isStaff, userMethods.getAllUsers)
userRouter.get('/stats', authServices.authenticateToken, authServices.isStaff, userMethods.getUserStats)
userRouter.get('/entrenadores', authServices.authenticateToken, userMethods.getAllEntrenadores)
userRouter.get('/admins', authServices.authenticateToken, authServices.isAdminOrRecepcion, userMethods.getAllAdmins)
// El alta la hace todo el staff; createUser limita qué tipo puede asignar cada rol
// (entrenador: sólo cliente · recepción: cliente o entrenador · admin: sin límite).
userRouter.post('/', authServices.authenticateToken, authServices.isStaff, upload.single('avatar'), userMethods.createUser)
userRouter.post('/import', authServices.authenticateToken, authServices.isAdminOrRecepcion, userMethods.importUsers)
userRouter.put('/:id/salud', authServices.authenticateToken, authServices.isStaff, userMethods.updateUserHealth)
userRouter.get('/:id', authServices.authenticateToken, authServices.isSelfOrStaff, userMethods.getUserById)
userRouter.put('/:id', authServices.authenticateToken, authServices.isAdminOrRecepcion, upload.single('avatar'), userMethods.updateUser)
userRouter.delete('/:id', authServices.authenticateToken, authServices.isAdminOrRecepcion, userMethods.deleteUser)

export default userRouter;
