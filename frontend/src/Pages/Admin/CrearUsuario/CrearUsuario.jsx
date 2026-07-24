import React, { useState, useEffect, useMemo } from 'react';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import CustomDropdown from '../../../Components/utils/CustomDropdown/CustomDropdown';
import apiClient from '../../../axiosConfig';
import apiService from '../../../services/apiService';
import { toast } from 'react-toastify';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import { useNavigate } from 'react-router-dom';
import CustomInput from '../../../Components/utils/CustomInput/CustomInput';
import '../UsuarioForm.css';
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton';
import { ArrowLeft } from 'lucide-react';
import { ROLES, TIPOS_USUARIO, getRolActual } from '../../../utils/roles';

const DAY_ORDER = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3,
  jueves: 4, viernes: 5, sabado: 6, sábado: 6,
};

const formatHora = (iso) => (iso || '').slice(11, 16);

const sortHorarios = (horarios) =>
  [...horarios].sort((a, b) => {
    const dayA = DAY_ORDER[String(a.diaSemana).trim().toLowerCase()] ?? 99;
    const dayB = DAY_ORDER[String(b.diaSemana).trim().toLowerCase()] ?? 99;
    if (dayA !== dayB) return dayA - dayB;
    return formatHora(a.horaIni).localeCompare(formatHora(b.horaIni));
  });

// Motivos de alta (debe coincidir con MOTIVOS_ALTA del backend en user.Controller.ts)
const MOTIVOS_ALTA = [
  'Buenas instalaciones',
  'Precio competitivo / promoción',
  'Buena atención',
  'Cercanía / ubicación',
  'Recomendación de un conocido',
  'Redes sociales / publicidad',
  'Variedad de clases y horarios',
  'Calidad de los entrenadores',
  'Recomendación médica / salud',
  'Otro / Sin motivo',
];

const CrearUsuario = ({fromAdmin, fromEntrenador}) => {
  const initialFormData = {
    email: '',
    password: '',
    dni: '',
    nombre: '',
    apellido: '',
    profesion: '',
    direc: '',
    tel: '',
    tipo: '',
    fechaCumple: '',
    plan: '',
    motivoAlta: '',
    usaTurnosFijos: false,
    observacionesSalud: '',
    fichaMedicaUrl: '',
  };

  const [formData, setFormData] = useState(initialFormData);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [planOptions, setPlanOptions] = useState([]);
  const [planSesionesSemana, setPlanSesionesSemana] = useState(0);
  const [clases, setClases] = useState([]);
  const [turnosFijos, setTurnosFijos] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlanes = async () => {
      try {
        const data = await apiService.getPlanes();
        setPlanOptions(data.map(p => ({ label: p.nombre, value: p.ID_Plan, sesionesPorSemana: p.sesionesPorSemana || 0 })));
      } catch (error) {
        console.error('Error al cargar planes:', error);
        toast.error('No se pudieron cargar los planes disponibles');
      }
    };
    fetchPlanes();
    const fetchClases = async () => {
      try {
        const data = await apiService.getClases();
        setClases(data || []);
      } catch (error) {
        console.error('Error al cargar clases:', error);
      }
    };
    fetchClases();
  }, []);

  const clasesWithAvailable = useMemo(() =>
    clases.filter(c =>
      (c.HorariosClase || []).some(h =>
        h.activo !== false && (h.cupos - (h.turnosFijosCount || 0)) > 0
      )
    ),
    [clases]
  );

  const getClaseForHorario = (horarioId) =>
    clases.find(c => c.HorariosClase?.some(h => h.ID_HorarioClase === horarioId)) || null;

  const getDiaForHorario = (horarioId) => {
    for (const c of clases) {
      const h = (c.HorariosClase || []).find(h => h.ID_HorarioClase === horarioId);
      if (h) return String(h.diaSemana || '').trim().toLowerCase();
    }
    return null;
  };

  const getHorariosForClase = (claseId) => {
    const clase = clases.find(c => c.ID_Clase === claseId);
    if (!clase) return [];
    return sortHorarios(
      (clase.HorariosClase || []).filter(h =>
        h.activo !== false && (h.cupos - (h.turnosFijosCount || 0)) > 0
      )
    );
  };

  const getFirstHorarioForClase = (claseId) => getHorariosForClase(claseId)[0] || null;

  const addTurnoFijo = () => {
    if (turnosFijos.length >= 7) {
      toast.warning('Máximo un turno fijo por día (hasta 7).');
      return;
    }
    const firstClase = clasesWithAvailable[0];
    if (!firstClase) {
      toast.warning('No hay clases con horarios disponibles.');
      return;
    }
    const firstHorario = getFirstHorarioForClase(firstClase.ID_Clase);
    setTurnosFijos(prev => [...prev, {
      horarioId: firstHorario?.ID_HorarioClase || null,
      editing: true,
    }]);
  };

  const updateHorario = (index, horarioId) => {
    setTurnosFijos(prev => prev.map((item, idx) =>
      idx === index ? { ...item, horarioId } : item
    ));
  };

  const updateClase = (index, claseId) => {
    const firstHorario = getFirstHorarioForClase(claseId);
    setTurnosFijos(prev => prev.map((item, idx) =>
      idx === index ? { ...item, horarioId: firstHorario?.ID_HorarioClase || null } : item
    ));
  };

  const removeTurnoFijo = (index) => {
    setTurnosFijos(prev => prev.filter((_, idx) => idx !== index));
  };

  const confirmTurnoFijo = (index) => {
    const current = turnosFijos[index];
    const dia = current?.horarioId ? getDiaForHorario(current.horarioId) : null;
    if (dia && turnosFijos.some((t, i) => i !== index && t.horarioId && getDiaForHorario(t.horarioId) === dia)) {
      toast.warning('Ya tenés un turno fijo ese día. No se permiten dos turnos fijos el mismo día.');
      return;
    }
    setTurnosFijos(prev => prev.map((item, idx) =>
      idx === index ? { ...item, editing: false } : item
    ));
  };

  const editTurnoFijo = (index) => {
    setTurnosFijos(prev => prev.map((item, idx) =>
      idx === index ? { ...item, editing: true } : item
    ));
  };

  const handleChange = (eOrVal) => {
    const { name, value, type, checked } = eOrVal.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    } else {
      setAvatarFile(null);
      setAvatarPreview("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();            // ← evita el submit nativo
    if (isLoading) return;

    // Validación de email tolerante a acentos/Unicode (el type="email" nativo rechaza no-ASCII).
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test((formData.email || '').trim())) {
      toast.error('Ingresá un email válido');
      return;
    }

    try {
      setIsLoading(true);

      // Normalizo la fecha (si tu API espera "YYYY-MM-DD", enviá esa forma)
      const fechaPlano = formData.fechaCumple || '';
      const isoFecha = fechaPlano ? new Date(fechaPlano).toISOString() : '';

      // Valido plan si es Cliente
      let idPlan = null;
      if (formData.tipo === ROLES.CLIENTE) {
        if (!formData.dni.trim()) {
          toast.error('Ingresá el DNI del alumno');
          setIsLoading(false);
          return;
        }
        const selectedPlan = planOptions.find(p => p.label === formData.plan);
        if (!selectedPlan) {
          toast.error('Seleccioná un plan');
          setIsLoading(false);
          return;
        }
        idPlan = selectedPlan.value;
      }

      const payload = new FormData();
      payload.append('email', formData.email.trim());
      payload.append('password', formData.password);
      payload.append('dni', formData.dni.trim());
      payload.append('nombre', formData.nombre.trim());
      payload.append('apellido', formData.apellido.trim());
      payload.append('direc', formData.direc.trim());
      payload.append('tel', formData.tel.trim());
      payload.append('tipo', formData.tipo || '');
      payload.append('fechaCumple', isoFecha);
      payload.append('observacionesSalud', formData.observacionesSalud.trim());
      payload.append('fichaMedicaUrl', formData.fichaMedicaUrl.trim());
      if (formData.motivoAlta) payload.append('motivoAlta', formData.motivoAlta);

      if (idPlan) payload.append('ID_Plan', idPlan);
      payload.append('usaTurnosFijos', String(formData.usaTurnosFijos));
      if (formData.usaTurnosFijos) {
        const uniqueTurnos = turnosFijos.map(t => t.horarioId).filter(Boolean);
        if (uniqueTurnos.length === 0) {
          toast.error('Seleccioná al menos un turno fijo');
          setIsLoading(false);
          return;
        }
        payload.append('turnosFijos', JSON.stringify(uniqueTurnos));
      }
      if (formData.tipo === ROLES.ENTRENADOR && formData.profesion) {
        payload.append('profesion', formData.profesion.trim());
      }
      if (avatarFile) {
        payload.append('avatar', avatarFile);
      }

      await apiClient.post('/usuarios', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Usuario añadido correctamente');
      setFormData(initialFormData);
      setTurnosFijos([]);
      setAvatarFile(null);
      setAvatarPreview("");
      navigate(fromEntrenador ? "/entrenador/usuarios" : "/admin/usuarios");
    } catch (error) {
      console.error(error);
      const msg = error?.response?.data?.message || 'No se pudo registrar el usuario';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Espejo de la guarda del backend (TIPOS_ASIGNABLES en user.Controller.ts):
  // entrenador da de alta sólo socios; recepción, socios y entrenadores.
  const tiposAsignables = {
    [ROLES.ENTRENADOR]: [ROLES.CLIENTE],
    [ROLES.RECEPCION]: [ROLES.CLIENTE, ROLES.ENTRENADOR],
  }[getRolActual()];
  const tipos = tiposAsignables
    ? TIPOS_USUARIO.filter(t => tiposAsignables.includes(t.value))
    : TIPOS_USUARIO;

  return (
    <div className="page-layout">
      {isLoading && <LoaderFullScreen />}
      <SidebarMenu isAdmin={fromAdmin} isEntrenador={fromEntrenador} />
      <div className="content-layout">
        <div className="usuario-form-page">
          <SecondaryButton
            text="Volver atrás"
            linkTo={fromEntrenador ? "/entrenador/usuarios" : "/admin/usuarios"}
            icon={ArrowLeft}
            reversed={true}
          />
          <h2>Crear usuario</h2>

          <form className="usuario-form" onSubmit={handleSubmit}>
            <div className="usuario-form-field">
              <label htmlFor="email">Email</label>
              <CustomInput
                type="text" id="email" name="email"
                value={formData.email} onChange={handleChange}
                required placeholder="Ingresa tu email" width="100%"
              />
            </div>

            <div className="usuario-form-field">
              <label htmlFor="password">Contraseña</label>
              <CustomInput
                type="password" id="password" name="password"
                value={formData.password} onChange={handleChange}
                required placeholder="Ingresa tu contraseña" width="100%"
              />
            </div>

            <div className="usuario-form-field">
              <label htmlFor="dni">DNI</label>
              <CustomInput
                type="text" id="dni" name="dni"
                value={formData.dni} onChange={handleChange}
                placeholder="Ingresa el DNI" width="100%"
              />
            </div>

            <div className="usuario-form-field">
              <label htmlFor="nombre">Nombre</label>
              <CustomInput
                type="text" id="nombre" name="nombre"
                value={formData.nombre} onChange={handleChange}
                placeholder="Ingresa el nombre" width="100%"
              />
            </div>

            <div className="usuario-form-field">
              <label htmlFor="apellido">Apellido</label>
              <CustomInput
                type="text" id="apellido" name="apellido"
                value={formData.apellido} onChange={handleChange}
                placeholder="Ingresa el apellido" width="100%"
              />
            </div>

            <div className="usuario-form-field">
              <label htmlFor="tipo">Tipo de usuario</label>
              <CustomDropdown
                options={tipos}
                value={formData.tipo}
                onChange={(val) =>
                  setFormData(f => ({
                    ...f,
                    tipo: typeof val === 'string' ? val : val.target.value,
                  }))
                }
                name="tipo" id="tipo"
              />
            </div>

          {formData.tipo === ROLES.CLIENTE && (
            <div className="usuario-form-field usuario-form-field--full">
              <label htmlFor="plan">Plan</label>
              <CustomDropdown
                options={planOptions.map(p => p.label)}
                value={formData.plan}
                onChange={(e) => {
                  const label = e?.target?.value ?? '';
                  const selected = planOptions.find(p => p.label === label);
                  setPlanSesionesSemana(selected?.sesionesPorSemana || 0);
                  setFormData(f => ({ ...f, plan: label }));
                }}
                name="plan" id="plan"
              />

              <label htmlFor="motivoAlta" style={{ marginTop: '12px' }}>Motivo de alta (opcional)</label>
              <CustomDropdown
                options={MOTIVOS_ALTA}
                value={formData.motivoAlta}
                onChange={handleChange}
                name="motivoAlta" id="motivoAlta"
                placeholderOption="— Seleccioná un motivo —"
                placeholderDisabled={false}
              />

              <label className="usuario-form-toggle">
                  <span className="toggle-switch">
                    <input
                      type="checkbox"
                      name="usaTurnosFijos"
                      checked={formData.usaTurnosFijos}
                      onChange={handleChange}
                    />
                    <span className="toggle-slider"></span>
                  </span>
                  Usa turnos fijos
                </label>

              {formData.usaTurnosFijos && (
                <div className="usuario-turnos-fijos">
                  {turnosFijos.map((item, index) => {
                    const clase = item.horarioId ? getClaseForHorario(item.horarioId) : null;
                    const horario = item.horarioId
                      ? (() => {
                          for (const c of clases) {
                            const h = c.HorariosClase?.find(h => h.ID_HorarioClase === item.horarioId);
                            if (h) return h;
                          }
                          return null;
                        })()
                      : null;

                    return (
                      <div key={index} className="usuario-turno-fijo-row">
                        {item.editing ? (
                          <>
                            <CustomDropdown
                              options={clasesWithAvailable.map(c => c.nombre)}
                              value={(item.horarioId ? getClaseForHorario(item.horarioId) : null)?.nombre || clasesWithAvailable[0]?.nombre || ''}
                              onChange={(e) => {
                                const val = e?.target?.value ?? '';
                                const c = clasesWithAvailable.find(c => c.nombre === val);
                                if (c) updateClase(index, c.ID_Clase);
                              }}
                              name={`clase-${index}`}
                              id={`clase-${index}`}
                            />
                            <select
                              value={item.horarioId || ''}
                              onChange={(e) => updateHorario(index, Number(e.target.value))}
                              className="turno-fijo-select"
                            >
                              {(() => {
                                const currentClase = getClaseForHorario(item.horarioId);
                                const claseId = currentClase?.ID_Clase || clasesWithAvailable[0]?.ID_Clase;
                                return getHorariosForClase(claseId).map(h => (
                                  <option key={h.ID_HorarioClase} value={h.ID_HorarioClase}>
                                    {h.diaSemana} {formatHora(h.horaIni)} ({h.cupos - (h.turnosFijosCount || 0)} disp.)
                                  </option>
                                ));
                              })()}
                            </select>
                            <button type="button" className="turno-fijo-btn turno-fijo-btn-confirm" onClick={() => confirmTurnoFijo(index)}>Confirmar</button>
                            <button type="button" className="turno-fijo-btn turno-fijo-btn-remove" onClick={() => removeTurnoFijo(index)}>Quitar</button>
                          </>
                        ) : (
                          <>
                            <span className="turno-fijo-preview">
                              {clase?.nombre || '?'} · {horario?.diaSemana || '?'} {formatHora(horario?.horaIni)}
                            </span>
                            <button type="button" className="turno-fijo-btn turno-fijo-btn-edit" onClick={() => editTurnoFijo(index)}>Editar</button>
                            <button type="button" className="turno-fijo-btn turno-fijo-btn-remove" onClick={() => removeTurnoFijo(index)}>Quitar</button>
                          </>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" className="turno-fijo-btn-add" onClick={addTurnoFijo} disabled={clasesWithAvailable.length === 0}>
                    + Agregar turno fijo
                  </button>
                  <span className="usuario-form-help">
                    Máximo un turno fijo por día.
                  </span>
                </div>
              )}
            </div>
          )}

          {formData.tipo === ROLES.ENTRENADOR && (
            <div className="usuario-form-field">
              <label htmlFor="profesion">Profesión</label>
              <CustomInput
                type="text" id="profesion" name="profesion"
                value={formData.profesion} onChange={handleChange}
                placeholder="Ingresa la profesión" width="100%"
              />
            </div>
          )}

            <div className="usuario-form-field">
              <label htmlFor="direc">Dirección</label>
              <CustomInput
                type="text" id="direc" name="direc"
                value={formData.direc} onChange={handleChange}
                placeholder="Ingresa la dirección" width="100%"
              />
            </div>

            <div className="usuario-form-field">
              <label htmlFor="tel">Teléfono</label>
              <CustomInput
                type="tel" id="tel" name="tel"
                value={formData.tel} onChange={handleChange}
                placeholder="Ingresa el teléfono" width="100%"
              />
            </div>

            <div className="usuario-form-field">
              <label htmlFor="fechaCumple">Fecha de nacimiento</label>
              <CustomInput
                type="date" id="fechaCumple" name="fechaCumple"
                value={formData.fechaCumple} onChange={handleChange}
                width="100%"
              />
            </div>

            <div className="usuario-form-field">
              <label htmlFor="fichaMedicaUrl">Ficha médica</label>
              <CustomInput
                type="text" id="fichaMedicaUrl" name="fichaMedicaUrl"
                value={formData.fichaMedicaUrl} onChange={handleChange}
                placeholder="URL de la ficha médica" width="100%"
              />
            </div>

            <div className="usuario-form-field usuario-form-field--full">
              <label htmlFor="observacionesSalud">Observaciones de salud</label>
              <textarea
                id="observacionesSalud"
                name="observacionesSalud"
                value={formData.observacionesSalud}
                onChange={handleChange}
                placeholder="Observaciones de salud"
                rows={5}
                className="usuario-form-textarea"
              />
            </div>

            <div className="usuario-form-field">
              <label htmlFor="avatar">Avatar</label>
              <input
                type="file" id="avatar" name="avatar"
                accept="image/*" onChange={handleFileChange}
              />
            </div>

          {avatarPreview && (
            <div className="preview-container usuario-form-preview">
              <img
                src={avatarPreview} alt="Preview clase"
                className="preview-img" width={300}
              />
            </div>
          )}

            <div className="usuario-form-actions">
              <button type="submit" className="primary-button" disabled={isLoading}>
                {isLoading ? "Creando..." : "Crear usuario"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CrearUsuario;
