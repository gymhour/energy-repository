import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import LoginBackgroundImage from "../../../assets/login/login_background.png";
import CustomInput from '../../../Components/utils/CustomInput/CustomInput';
import apiService from '../../../services/apiService';
import { toast } from 'react-toastify';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';

const ResetPassword = () => {
  const [nuevaContraseña, setNuevaContraseña] = useState('');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // refs para limpiar correctamente
  const intervalRef = useRef(null);
  const toastIdRef = useRef(null);

  useEffect(() => {
    return () => {
      // cleanup si el usuario navega antes de terminar el countdown
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (toastIdRef.current) toast.dismiss(toastIdRef.current);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      toast.error('Token inválido o faltante en la URL');
      return;
    }

    const body = {
      newPassword: nuevaContraseña,
      token
    };

    setIsLoading(true);

    try {
      await apiService.resetPassword(body);

      setIsLoading(false);

      const REDIRECT_SECONDS = 5;
      let remaining = REDIRECT_SECONDS;

      if (intervalRef.current) clearInterval(intervalRef.current);

      toastIdRef.current = toast.success(
        `Contraseña actualizada correctamente. Redirigiendo en ${remaining}s...`,
        { autoClose: false, closeOnClick: false, draggable: false, hideProgressBar: false }
      );

      intervalRef.current = setInterval(() => {
        remaining -= 1;

        if (remaining > 0) {
          toast.update(toastIdRef.current, {
            render: `Contraseña actualizada correctamente. Redirigiendo en ${remaining}s...`,
            progress: (REDIRECT_SECONDS - remaining) / REDIRECT_SECONDS
          });
        } else {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          toast.update(toastIdRef.current, { render: 'Redirigiendo...', autoClose: 800, progress: 1 });
          navigate('/', { replace: true });
        }
      }, 1000);

    } catch (error) {
      setIsLoading(false);
      toast.error('Error al crear nueva contraseña');
    }
  };

  return (
    <div
      className='reset-container'
      style={{ backgroundImage: `url(${LoginBackgroundImage})` }}
    >
      {isLoading && <LoaderFullScreen/>}
      <div className="reset-subcontainer">
        <div className='reset-subcontainer-title'>
          <h4>Ingrese su nueva contraseña</h4>
        </div>
        <div className="reset-form-container">
          <form onSubmit={handleSubmit}>
            <CustomInput
              type="password"
              placeholder="Nueva contraseña"
              value={nuevaContraseña}
              onChange={(e) => setNuevaContraseña(e.target.value)}
              width='100%'
              required
              disabled={isLoading}
            />
            <button type="submit" className='forgot-pass-btn' disabled={isLoading}>
              {isLoading ? 'Guardando...' : 'Continuar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;