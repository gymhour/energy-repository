import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const HOME_BY_ROLE = {
  admin: '/admin/inicio',
  entrenador: '/entrenador/inicio',
  cliente: '/alumno/inicio',
};

// Rol requerido según el prefijo de la ruta. Esto es defensa en profundidad / UX:
// evita que un usuario logueado cargue la vista de otro rol tipeando la URL.
// La barrera real de los datos sigue siendo el chequeo de rol del backend por endpoint.
// Solo restringimos las áreas de admin/entrenador (las sensibles). El área de alumno queda
// abierta a cualquier usuario autenticado para no bloquear cuentas con 'tipo' en variantes de
// casing (ej. 'Cliente'); el objetivo es mantener a los alumnos FUERA de admin/entrenador.
const ROLES_BY_PREFIX = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/entrenador', roles: ['admin', 'entrenador'] },
];

const ProtectedRoute = ({ children, roles }) => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/" replace />;

  let tipo = '';
  try {
    const decoded = jwtDecode(token);
    if (Date.now() >= decoded.exp * 1000) {
      localStorage.removeItem('token');
      return <Navigate to="/" replace />;
    }
    tipo = (decoded.tipo || '').toLowerCase();
  } catch {
    localStorage.removeItem('token');
    return <Navigate to="/" replace />;
  }

  // 'roles' explícito (si se pasa) tiene prioridad; si no, se deriva del prefijo de la ruta.
  const requiredRoles = roles
    || ROLES_BY_PREFIX.find(entry => location.pathname.startsWith(entry.prefix))?.roles;

  if (Array.isArray(requiredRoles) && requiredRoles.length > 0 && !requiredRoles.includes(tipo)) {
    return <Navigate to={HOME_BY_ROLE[tipo] || '/'} replace />;
  }

  return children;
};

export default ProtectedRoute;
