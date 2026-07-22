import React, { useRef, useState } from 'react';
import CustomInput from '../utils/CustomInput/CustomInput';
import './CheckInSections.css';

const DNICheckInSection = ({ onCheckIn, loading }) => {
  const [dni, setDni] = useState('');
  const dniInputRef = useRef(null);

  const handleSubmit = async event => {
    event.preventDefault();
    const cleanDni = dni.trim();

    if (!cleanDni || loading) return;

    await onCheckIn(cleanDni);
    setDni('');
    dniInputRef.current?.focus();
  };

  return (
    <form className="checkin-section" onSubmit={handleSubmit}>
      <div className="checkin-section-header">
        <h3>Ingreso por DNI</h3>
        <p>Ingresá el documento del alumno para validar su acceso.</p>
      </div>
      <div className="dni-checkin-row">
        <CustomInput
          ref={dniInputRef}
          value={dni}
          onChange={event => setDni(event.target.value.replace(/\D/g, ''))}
          placeholder="Ingresar DNI"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          aria-label="DNI del alumno"
          maxLength={10}
          width="100%"
          className="dni-checkin-input"
        />
        <button type="submit" className="attendance-primary-action" disabled={loading || !dni.trim()}>
          {loading ? 'Verificando...' : 'Verificar ingreso'}
        </button>
      </div>
    </form>
  );
};

export default DNICheckInSection;
