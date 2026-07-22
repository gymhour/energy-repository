import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { toast } from 'react-toastify';
import Select from 'react-select';
import apiService from '../../../services/apiService';
import CustomDropdown from '../CustomDropdown/CustomDropdown';
import './ReprogramarTurnoModal.css';

const normalizeDay = (d) =>
  String(d || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// JS Date.getDay(): 0=domingo ... 6=sábado
const DAY_INDEX = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

const formatHora = (iso) => String(iso || '').substr(11, 5);

const turnoUserToOption = (usuario) => ({
  value: usuario.ID_Usuario,
  label: `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || usuario.email || `Usuario #${usuario.ID_Usuario}`,
  email: usuario.email,
  dni: usuario.dni,
});

const turnoSelectStyles = {
  control: (base, state) => ({
    ...base,
    width: '100%',
    minHeight: 44,
    borderRadius: 8,
    borderColor: state.isFocused ? 'rgba(218, 70, 50, 0.48)' : 'var(--border-color)',
    backgroundColor: 'var(--background-color-distinct)',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(218, 70, 50, 0.12)' : 'none',
    color: 'var(--text-color)',
    fontSize: 14,
    ':hover': {
      borderColor: 'rgba(218, 70, 50, 0.48)',
    },
  }),
  menu: (base) => ({
    ...base,
    zIndex: 1001,
    overflow: 'hidden',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    backgroundColor: 'var(--background-color)',
    boxShadow: '0 18px 40px rgba(0, 0, 0, 0.12)',
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? 'var(--background-hover-color)' : 'var(--background-color)',
    color: 'var(--text-color)',
    fontSize: 14,
    padding: '10px 12px',
  }),
  singleValue: (base) => ({ ...base, color: 'var(--text-color)' }),
  input: (base) => ({ ...base, color: 'var(--text-color)' }),
  placeholder: (base) => ({ ...base, color: 'var(--text-color-distinct)' }),
};

/**
 * Flujo "Eliminar y reprogramar" (solo admin):
 * Paso 1: confirma el borrado FÍSICO de un turno AUSENTE/CANCELADO (libera sesión y día).
 * Paso 2: crea un turno nuevo para el mismo alumno (clase → horario → fecha).
 *
 * Props:
 *  - isOpen
 *  - user:  { id, nombre }
 *  - turno: { id, label }  (label descriptivo: "Lunes 09/06 07:00 · CrossFit")
 *  - createOnly: saltea el borrado y abre directamente la creación manual.
 *  - allowUserSelection: permite elegir el alumno dentro del modal.
 *  - onClose()
 *  - onDeleted()  → refrescar la lista del caller apenas se borra
 */
const ReprogramarTurnoModal = ({ isOpen, user, turno, createOnly = false, allowUserSelection = false, onClose, onDeleted }) => {
  const [step, setStep] = useState(createOnly ? 'create' : 'confirm'); // 'confirm' | 'create'
  const [loading, setLoading] = useState(false);
  const [clases, setClases] = useState([]);
  const [selectedClaseId, setSelectedClaseId] = useState('');
  const [selectedHorarioId, setSelectedHorarioId] = useState('');
  const [fecha, setFecha] = useState(null);
  const [selectedUserOpt, setSelectedUserOpt] = useState(user ? { value: user.id, label: user.nombre } : null);
  const [userOptions, setUserOptions] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStep(createOnly ? 'create' : 'confirm');
    setSelectedClaseId('');
    setSelectedHorarioId('');
    setFecha(null);
    setSelectedUserOpt(user ? { value: user.id, label: user.nombre } : null);
    setUserSearch('');
    apiService
      .getClases()
      .then((data) => setClases(Array.isArray(data) ? data : []))
      .catch(() => toast.error('No se pudieron cargar las clases.'));
  }, [isOpen, createOnly, user]);

  useEffect(() => {
    if (!isOpen || !allowUserSelection) return undefined;
    const trimmedSearch = userSearch.trim();

    if (trimmedSearch.length < 2) {
      setUserOptions([]);
      setUsersLoading(false);
      return undefined;
    }

    let isCurrentRequest = true;
    setUsersLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await apiService.getAllUsuarios({
          page: 1,
          take: 20,
          tipo: 'cliente',
          estado: true,
          search: trimmedSearch,
        });

        if (!isCurrentRequest) return;
        const options = Array.isArray(response?.data)
          ? response.data.map(turnoUserToOption)
          : [];
        setUserOptions(options);
      } catch (error) {
        if (isCurrentRequest) {
          setUserOptions([]);
          toast.error('No se pudieron buscar usuarios.');
        }
      } finally {
        if (isCurrentRequest) setUsersLoading(false);
      }
    }, 300);

    return () => {
      isCurrentRequest = false;
      clearTimeout(timeoutId);
    };
  }, [isOpen, allowUserSelection, userSearch]);

  const claseSeleccionada = useMemo(
    () => clases.find((c) => String(c.ID_Clase) === String(selectedClaseId)),
    [clases, selectedClaseId]
  );

  const horariosDisponibles = useMemo(
    () => (claseSeleccionada?.HorariosClase || []).filter((h) => h.activo !== false),
    [claseSeleccionada]
  );

  const horarioSeleccionado = useMemo(
    () => horariosDisponibles.find((h) => String(h.ID_HorarioClase) === String(selectedHorarioId)),
    [horariosDisponibles, selectedHorarioId]
  );

  const selectedUser = allowUserSelection && createOnly
    ? (selectedUserOpt ? { id: selectedUserOpt.value, nombre: selectedUserOpt.label } : null)
    : user;

  if (!isOpen || (!selectedUser && !allowUserSelection) || (!turno && !createOnly)) return null;

  const handleEliminar = async () => {
    setLoading(true);
    try {
      await apiService.deleteTurnoFisico(turno.id);
      toast.success('Turno eliminado definitivamente.');
      onDeleted?.();
      setStep('create');
    } catch (err) {
      toast.error(err.message || 'No se pudo eliminar el turno.');
    } finally {
      setLoading(false);
    }
  };

  const handleCrear = async (event) => {
    event?.preventDefault();

    if (!selectedUser || !horarioSeleccionado || !fecha) {
      toast.error('Seleccioná usuario, clase, horario y fecha.');
      return;
    }
    const [hh, mm] = formatHora(horarioSeleccionado.horaIni).split(':').map(Number);
    const fechaIso = new Date(
      Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), hh || 0, mm || 0, 0, 0)
    ).toISOString();

    setLoading(true);
    try {
      await apiService.postTurno({
        ID_Usuario: selectedUser.id,
        ID_HorarioClase: Number(horarioSeleccionado.ID_HorarioClase),
        fecha: fechaIso,
      });
      toast.success(`Turno nuevo creado para ${selectedUser.nombre}.`);
      onClose();
    } catch (err) {
      // Errores de negocio del backend (sin cupo / tope del período / cuota): se muestran y el
      // modal queda abierto para elegir otro horario.
      toast.error(err.message || 'No se pudo crear el turno.');
    } finally {
      setLoading(false);
    }
  };

  const diaIdxHorario = horarioSeleccionado
    ? DAY_INDEX[normalizeDay(horarioSeleccionado.diaSemana)]
    : null;

  return (
    <div
      className="cuotas-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`cuotas-modal ${createOnly && allowUserSelection ? '' : 'cuotas-modal-small'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reprogramar-turno-title"
      >
        <form className="modal-form turno-modal-form" onSubmit={step === 'create' ? handleCrear : (e) => e.preventDefault()}>
          <div className="cuotas-modal-header">
            <div>
              <h3 id="reprogramar-turno-title">
                {step === 'confirm' ? 'Eliminar y reprogramar turno' : 'Crear turno'}
              </h3>
              <span>
                {step === 'confirm'
                  ? `Alumno: ${user.nombre}`
                  : createOnly
                    ? allowUserSelection
                      ? 'Cargá una reserva manual para un alumno activo.'
                      : `Elegí el turno para ${selectedUser.nombre}.`
                    : `El turno anterior fue eliminado. Elegí el nuevo turno para ${selectedUser.nombre}.`}
              </span>
            </div>
            <button type="button" className="cuotas-modal-close" onClick={onClose} aria-label="Cerrar modal">
              <X size={18} />
            </button>
          </div>

          {step === 'confirm' ? (
            <>
              <p style={{ margin: '16px 0 4px', fontSize: 14, lineHeight: 1.5, color: 'var(--text-color-distinct)' }}>
                Se eliminará <strong style={{ color: 'var(--text-color)' }}>definitivamente</strong> el turno:
              </p>
              <p style={{ margin: '4px 0 8px', fontSize: 15, fontWeight: 600, color: 'var(--text-color)' }}>
                {turno?.label}
              </p>
              <p style={{ margin: '0 0 6px', fontSize: 13, lineHeight: 1.5, color: 'var(--text-color-distinct)' }}>
                Esto libera la sesión del período y el día, y a continuación vas a poder crearle un turno nuevo.
              </p>

              <div className="cuotas-modal-actions">
                <button type="button" className="cuotas-modal-secondary-button" onClick={onClose}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="cuotas-modal-primary-button"
                  style={{ backgroundColor: '#e5484d', borderColor: '#e5484d' }}
                  onClick={handleEliminar}
                  disabled={loading}
                >
                  {loading ? 'Eliminando…' : 'Eliminar turno'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="cuotas-modal-grid">
                {allowUserSelection && createOnly && (
                  <div className="cuotas-modal-field cuotas-modal-field-wide">
                    <label>Usuario</label>
                    <Select
                      className="cuotas-select"
                      classNamePrefix="cuotas-select"
                      options={userOptions}
                      value={selectedUserOpt}
                      onChange={setSelectedUserOpt}
                      onInputChange={(value, meta) => {
                        if (meta.action === 'input-change') setUserSearch(value);
                      }}
                      placeholder="Seleccioná un usuario"
                      noOptionsMessage={() => userSearch.trim().length < 2 ? 'Escribí al menos 2 caracteres' : 'No se encontraron usuarios'}
                      loadingMessage={() => 'Buscando usuarios...'}
                      formatOptionLabel={(option, { context }) => (
                        context === 'menu' ? (
                          <div className="turno-user-option">
                            <span>{option.label}</span>
                            {(option.dni || option.email) && (
                              <small>{option.dni ? `DNI ${option.dni}` : option.email}</small>
                            )}
                          </div>
                        ) : option.label
                      )}
                      isClearable
                      isSearchable
                      isLoading={usersLoading}
                      filterOption={null}
                      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                      styles={turnoSelectStyles}
                    />
                  </div>
                )}

                <div className="cuotas-modal-field">
                  <label>Clase</label>
                  <CustomDropdown
                    options={clases.map((c) => ({ value: String(c.ID_Clase), label: c.nombre }))}
                    value={selectedClaseId}
                    onChange={(e) => {
                      setSelectedClaseId(e.target.value);
                      setSelectedHorarioId('');
                      setFecha(null);
                    }}
                    placeholderOption="Seleccioná una clase"
                  />
                </div>

                <div className="cuotas-modal-field">
                  <label>Horario</label>
                  <CustomDropdown
                    options={horariosDisponibles.map((h) => ({
                      value: String(h.ID_HorarioClase),
                      label: `${h.diaSemana} ${formatHora(h.horaIni)} - ${formatHora(h.horaFin)}`,
                    }))}
                    value={selectedHorarioId}
                    onChange={(e) => {
                      setSelectedHorarioId(e.target.value);
                      setFecha(null);
                    }}
                    placeholderOption={selectedClaseId ? 'Seleccioná un horario' : 'Elegí una clase primero'}
                  />
                </div>

                <div className="cuotas-modal-field cuotas-modal-field-wide">
                  <label>Fecha {horarioSeleccionado ? `(solo ${horarioSeleccionado.diaSemana})` : ''}</label>
                  <ReactDatePicker
                    selected={fecha}
                    onChange={(d) => setFecha(d)}
                    dateFormat="dd/MM/yyyy"
                    placeholderText={horarioSeleccionado ? 'Seleccioná la fecha' : 'Elegí un horario primero'}
                    className="custom-datepicker"
                    filterDate={(d) => diaIdxHorario === null || d.getDay() === diaIdxHorario}
                    disabled={!horarioSeleccionado}
                  />
                </div>
              </div>

              <div className="cuotas-modal-actions">
                <button type="button" className="cuotas-modal-secondary-button" onClick={onClose}>
                  {createOnly ? 'Cancelar' : 'Omitir (no crear turno)'}
                </button>
                <button
                  type="submit"
                  className="cuotas-modal-primary-button"
                  disabled={loading || !selectedUser || !horarioSeleccionado || !fecha}
                >
                  {loading ? 'Creando…' : 'Crear turno'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default ReprogramarTurnoModal;
