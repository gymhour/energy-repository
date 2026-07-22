import express from 'express';
import { userMethods } from '../controllers/user.Controller.js';
import { authServices } from '../services/auth.service.js';
import upload from '../services/multer.service.js';

const userRouter = express.Router();


userRouter.put("/estado/:id", authServices.authenticateToken, authServices.isAdminOrEntrenador, userMethods.estadoUser);
userRouter.get('/', authServices.authenticateToken, authServices.isAdminOrEntrenador, userMethods.getAllUsers)
userRouter.get('/stats', authServices.authenticateToken, authServices.isAdminOrEntrenador, userMethods.getUserStats)
userRouter.get('/entrenadores', authServices.authenticateToken, userMethods.getAllEntrenadores)
userRouter.get('/admins', authServices.authenticateToken, authServices.isAdmin, userMethods.getAllAdmins)
userRouter.post('/', authServices.authenticateToken, authServices.isAdmin, upload.single('avatar'), userMethods.createUser)
userRouter.post('/import', authServices.authenticateToken, authServices.isAdmin, userMethods.importUsers)
userRouter.put('/:id/salud', authServices.authenticateToken, authServices.isAdminOrEntrenador, userMethods.updateUserHealth)
userRouter.get('/:id', authServices.authenticateToken, authServices.isSelfOrStaff, userMethods.getUserById)
userRouter.put('/:id', authServices.authenticateToken, authServices.isAdmin, upload.single('avatar'), userMethods.updateUser)
userRouter.delete('/:id', authServices.authenticateToken, authServices.isAdmin, userMethods.deleteUser)

export default userRouter;
