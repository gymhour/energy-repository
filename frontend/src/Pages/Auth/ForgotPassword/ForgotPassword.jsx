import React, { useState } from 'react';
import LoginBackgroundImage from "../../../assets/login/login_background.png"
import CustomInput from '../../../Components/utils/CustomInput/CustomInput';
import { Link } from 'react-router-dom';
import './ForgotPassword.css'
import apiService from '../../../services/apiService';
import { toast } from 'react-toastify';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = { email: email }

    setIsLoading(true)

    try {
      await apiService.forgotPassword(body);
      setIsLoading(false)
      toast.success('Email enviado correctamente. Por favor, revise su correo.');
    } catch (error) {
      setIsLoading(false)
      toast.error("Error al enviar mail de recuperación de contraseña.")
    }
  }

  return (
    <div className='reset-container' style={{ backgroundImage: `url(${LoginBackgroundImage})` }}>
      {isLoading && <LoaderFullScreen />}
      <div className="reset-subcontainer">
        <div className='reset-subcontainer-title'>
          <h4> Restablecer contraseña </h4>
          <p>
            Introduce la dirección de correo electrónico asociada a tu cuenta y te enviaremos un vínculo para restablecer tu contraseña.
          </p>
        </div>

        <div className="reset-form-container">
          <form className='forgot-pass-form' onSubmit={handleSubmit}>
            <CustomInput
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              width='100%'
              required
            />
            <button type="submit" className='forgot-pass-btn'>Continuar</button>
          </form>
        </div>

        <div className='reset-back-login-container'>
          <Link to="/" className='back-login-link'> Volver a inicio de sesión </Link>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword;