import { jwtDecode } from 'jwt-decode';

// Roles del sistema. Coinciden con los valores guardados en User.tipo (minúscula, sin acentos).
export const ROLES = {
  ADMIN: 'admin',
  ENTRENADOR: 'entrenador',
  RECEPCION: 'recepcion',
  CLIENTE: 'cliente',
};

// Etiqueta visible ↔ valor persistido.
// El mapa es necesario: 'Recepción'.toLowerCase() devuelve 'recepción' CON acento,
// que no matchea el rol que valida el backend.
export const TIPOS_USUARIO = [
  { label: 'Cliente', value: ROLES.CLIENTE },
  { label: 'Entrenador', value: ROLES.ENTRENADOR },
  { label: 'Recepción', value: ROLES.RECEPCION },
  { label: 'Admin', value: ROLES.ADMIN },
];

export const labelDeTipo = (value) => (
  TIPOS_USUARIO.find(t => t.value === String(value || '').toLowerCase())?.label || ''
);

export const valorDeTipo = (label) => (
  TIPOS_USUARIO.find(t => t.label === label)?.value || ''
);

/** Rol del usuario logueado, leído del JWT. Devuelve '' si no hay token válido. */
export const getRolActual = () => {
  const token = localStorage.getItem('token');
  if (!token) return '';
  try {
    return String(jwtDecode(token).tipo || '').toLowerCase();
  } catch {
    return '';
  }
};

export const esRecepcion = () => getRolActual() === ROLES.RECEPCION;

export const esAdmin = () => getRolActual() === ROLES.ADMIN;
