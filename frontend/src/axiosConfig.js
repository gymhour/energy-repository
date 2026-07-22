import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import CLIENT_SETUP from './setup';

// La URL de la API se configura en src/setup.js (apiUrl) o via REACT_APP_API_URL
const BASE_URL = CLIENT_SETUP.apiUrl;

// Cliente para login / register / cambiar contraseña (sin interceptores)
export const authClient = axios.create({
  baseURL: BASE_URL,
});

// Cliente general con interceptor de token
const apiClient = axios.create({
  baseURL: BASE_URL,
});

apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const { exp } = jwtDecode(token);
      if (Date.now() >= exp * 1000) {
        // token expirado: limpia y redirige
        localStorage.removeItem('token');
        window.location.href = '/';
        // cancelar la petición
        return Promise.reject(new axios.Cancel('Token expirado'));
      }
      config.headers.Authorization = `Bearer ${token}`;
    } catch {
      localStorage.removeItem('token');
      window.location.href = '/';
      return Promise.reject(new axios.Cancel('Token inválido'));
    }
  }
  return config;
}, error => Promise.reject(error));

apiClient.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default apiClient;
