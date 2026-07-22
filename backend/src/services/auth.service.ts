import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from "../models/user.interface.js";

const JWT_SECRET: string = process.env.JWT_SECRET ?? "";
if (!JWT_SECRET) {
  // Fail-closed: nunca firmar/verificar tokens con un secreto por defecto conocido.
  throw new Error("FATAL: la variable de entorno JWT_SECRET no está definida.");
}

export const generateToken = (user: User): string => {
  return jwt.sign({ id: user.ID_Usuario, email: user.email, tipo: user.tipo }, JWT_SECRET, { expiresIn: '1h' })
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      id: number;
      email: string;
      tipo: string | null;
    };

    req.user = {
      ID_Usuario: payload.id,
      email: payload.email,
      tipo: payload.tipo,
    };

    next();
  } catch (err) {
    console.error("Error en la autenticación:", err);
    res.status(403).json({ error: "No tienes acceso al recurso" });
    return;
  }
}

// Middleware genérico para requerir uno o varios roles
export const requireRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user || !user.tipo || !roles.includes(user.tipo)) {
      res.status(403).json({ error: `Acceso denegado: se requiere uno de los roles [${roles.join(', ')}]` });
      return;
    }
    next();
  };
};

// Middleware específico pedido: admin OR entrenador
export const isAdminOrEntrenador = requireRoles('admin', 'entrenador');

// Mantengo la compatibilidad con tu middleware isAdmin previo
export function isAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user || user.tipo !== 'admin') {
    res.status(403).json({ error: 'Acceso denegado: sólo administradores' });
    return;
  }
  next();
}

// Ownership: el propio usuario (token.id === :id), o staff (admin/entrenador) que puede ver a todos.
export function isSelfOrStaff(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }
  const targetId = Number.parseInt(req.params.id, 10);
  const tipo = String(user.tipo ?? '').toLowerCase();
  const esStaff = tipo === 'admin' || tipo === 'entrenador';
  if (!esStaff && user.ID_Usuario !== targetId) {
    res.status(403).json({ error: 'Acceso denegado: solo podés consultar tu propia información' });
    return;
  }
  next();
}

export const authServices = {
  generateToken,
  authenticateToken,
  isAdmin,
  requireRoles,
  isAdminOrEntrenador,
  isSelfOrStaff
};