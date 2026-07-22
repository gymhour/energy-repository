import React, { forwardRef, useState } from 'react';
import './customInput.css';
import { Eye, EyeOff } from 'lucide-react';

const CustomInput = forwardRef(({
  type = 'text',
  placeholder,
  value,
  onChange,
  required = false,
  width = '300px',
  className = '',
  ...rest
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);

  // Si el input es de tipo password, usamos el estado para alternar
  const inputType = type === 'password'
    ? (showPassword ? 'text' : 'password')
    : type;

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  return (
    <div className="custom-input-wrapper" style={{ width }}>
      <input
        {...rest}
        ref={ref}
        type={inputType}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className={['custom-input', className].filter(Boolean).join(' ')}
      />
      {type === 'password' && (
        <button
          type="button"
          className="password-toggle-btn"
          onClick={togglePasswordVisibility}
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {showPassword
            ? <EyeOff className="eye-icon" size={20} />
            : <Eye className="eye-icon" size={20} />
          }
        </button>
      )}
    </div>
  );
});

export default CustomInput;
