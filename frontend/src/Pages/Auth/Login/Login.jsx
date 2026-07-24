import React, { useState } from 'react';
// Css
import './login.css';
// Assets
import LoginBackgroundImage from '../../../assets/login/login_background.png';
import CLIENT_SETUP from '../../../setup'
// Funciones
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import apiClient from '../../../axiosConfig';
import { authClient } from '../../../axiosConfig';
import { jwtDecode } from 'jwt-decode';
// Componentes
import CustomInput from '../../../Components/utils/CustomInput/CustomInput';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import { toast } from 'react-toastify';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Theme state
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  // Listen for theme changes on body attribute
  React.useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const newTheme = document.body.getAttribute('data-theme');
          setCurrentTheme(newTheme || 'dark');
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // Initial check in case it changed before observe
    const initialTheme = document.body.getAttribute('data-theme');
    if (initialTheme) {
      setCurrentTheme(initialTheme);
    }

    return () => observer.disconnect();
  }, []);

  const logoSrc = currentTheme === 'light'
    ? (CLIENT_SETUP.branding.logoLight || CLIENT_SETUP.branding.logo)
    : CLIENT_SETUP.branding.logo;

  // --- Nuevo: estado del modal de cumpleaños y redirección pendiente ---
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState(null);
  const [currentUserForBirthdayKey, setCurrentUserForBirthdayKey] = useState(null);

  const todayKey = () => {
    // YYYY-MM-DD en horario local del navegador
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const buildBirthdayDismissKey = (userId) => `birthdayDismissed:${userId}:${todayKey()}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await authClient.post('/auth/login', { email, password });
      const token = response.data.token;
      const isBirthday = !!response.data.isBirthday;

      // Almacena el token en localStorage
      localStorage.setItem('token', token);

      // Decodifica el token
      const decodedToken = jwtDecode(token);
      localStorage.setItem("usuarioId", decodedToken.id);

      // Normaliza tipo
      const tipoNormalized = (decodedToken.tipo || '').toLowerCase();

      // Determina a dónde va a navegar
      const targetRoute =
        tipoNormalized === 'admin' ? '/admin/inicio'
          : tipoNormalized === 'entrenador' ? '/entrenador/inicio'
            : tipoNormalized === 'recepcion' ? '/recepcion/inicio'
              : '/alumno/inicio';

      // Control de cumpleaños: si es su cumpleaños y no lo descartó hoy, mostramos modal
      const userId = decodedToken.id;
      const dismissKey = buildBirthdayDismissKey(userId);
      const alreadyDismissedToday = localStorage.getItem(dismissKey) === '1';

      if (isBirthday && !alreadyDismissedToday) {
        setCurrentUserForBirthdayKey(dismissKey);
        setPendingRedirect(targetRoute);
        setShowBirthdayModal(true);
        toast.success('Inicio de sesión exitoso'); // puedes mantener el toast
      } else {
        // Navegación normal
        navigate(targetRoute);
        toast.success('Inicio de sesión exitoso');
      }

    } catch (error) {
      toast.error(
        error?.response?.data?.error
          ? error.response.data.error
          : "Error al iniciar sesión. Comprueba tus credenciales"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseBirthdayModal = () => {
    if (pendingRedirect) {
      navigate(pendingRedirect);
    }
  };

  return (
    <div className='login-container' style={{ backgroundImage: `url(${LoginBackgroundImage})` }}>
      {/* {isLoading && <LoaderFullScreen />} */}
      <div className="login-subcontainer">
        <div className="gym-logo-container">
          <img src={logoSrc} alt={CLIENT_SETUP.branding.logoAlt} width={120} />
        </div>

        <div className="form-container">
          <form onSubmit={handleSubmit}>
            <CustomInput
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              width='100%'
              required
            />
            <CustomInput
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              width='100%'
              required
            />

            <button className='btn-login' type="submit" disabled={isLoading}>
              {isLoading ? 'Ingresando...' : 'Iniciar sesión'}
            </button>

            <Link to="/forgot-password" className='forgot-password-link'>
              Me olvidé mi contraseña
            </Link>
          </form>
        </div>

        <div className="our-logo-container">
          <p> Gymhour - Software para gimnasios </p>
        </div>
      </div>

      {/* -------- Modal de Feliz Cumpleaños -------- */}
      {showBirthdayModal && (
        <div className="birthday-overlay" aria-modal="true" role="dialog">
          <div className="birthday-modal">
            <h3 style={{ margin: 0, fontSize: 22 }}>🎉 ¡Feliz cumpleaños! 🎉</h3>
            <p style={{ margin: '14px 0 0', lineHeight: 1.5 }}>
              Te deseamos un gran día y muchos logros. ¡A entrenar con todo! 💪
            </p>

            <button onClick={handleCloseBirthdayModal} className="btn-primary">
              Gracias 🙌
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;