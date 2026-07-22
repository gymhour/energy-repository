import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import CustomDropdown from '../../../Components/utils/CustomDropdown/CustomDropdown';
import CustomInput from '../../../Components/utils/CustomInput/CustomInput';
import apiService from '../../../services/apiService';
import { toast } from 'react-toastify';
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton';
import { ArrowLeft } from 'lucide-react';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import '../UsuarioForm.css';

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

const EditarUsuario = ({fromAdmin, fromEntrenador}) => {
  const { id } = useParams();

  const initialFormData = {
    email: '',
    dni: '',
    nombre: '',
    apellido: '',
    profesion: '',
    direc: '',
    tel: '',
    tipo: 'Cliente',
    fechaCumple: '',
    plan: '',
    estado: true,
    usaTurnosFijos: false,
    observacionesSalud: '',
    fichaMedicaUrl: '',
  };

  const [formData, setFormData] = useState(initialFormData);
  const [avatarFile, setAvatarFile] = useState(null);
  const [planOptions, setPlanOptions] = useState([]);
  const [planSesionesSemana, setPlanSesionesSemana] = useState(0);
  const [clases, setClases] = useState([]);
  const [turnosFijos, setTurnosFijos] = useState([]);

  const tipos = ['Cliente', 'Entrenador', 'Admin'];
  const opcionesEstado = ['Si', 'No'];
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlanes = async () => {
      try {
        const data = await apiService.getPlanes();

        setPlanOptions(data.map(p => ({ label: p.nombre, value: p.ID_Plan, sesionesPorSemana: p.sesionesPorSemana || 0 })))
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

  const getDiaForHorario = (horarioId) => {
    for (const c of clases) {
      const h = (c.HorariosClase || []).find(h => h.ID_HorarioClase === horarioId);
      if (h) return String(h.diaSemana || '').trim().toLowerCase();
    }
    return null;
  };

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

  useEffect(() => {
    setIsLoading(true);
    const fetchUser = async () => {
      try {
        const user = await apiService.getUserById(id);

        const fechaISO = user?.fechaCumple
          ? new Date(user.fechaCumple).toISOString().slice(0, 10)
          : '';

        const tipoLower = (user?.tipo || '').toLowerCase();
        const tipoCapitalizado =
          tipoLower ? tipoLower.charAt(0).toUpperCase() + tipoLower.slice(1) : 'Cliente';

        // Nombre de plan si existe (API puede devolver { plan: { nombre, ID_Plan } } o solo ID)
        const planNombre =
          user?.plan?.nombre
          || user?.plan?.label
          || ''; // si no hay plan, queda vacío y no rompe

        setFormData({
          email: user?.email || '',
          dni: user?.dni || '',
          nombre: user?.nombre || '',
          apellido: user?.apellido || '',
          profesion: user?.profesion || '',
          direc: user?.direc || '',
          tel: user?.tel || '',
          tipo: tipoCapitalizado,
          fechaCumple: fechaISO,
          estado: !!user?.estado,
          usaTurnosFijos: !!user?.usaTurnosFijos,
          plan: tipoLower === 'cliente' ? planNombre : '',
          observacionesSalud: user?.observacionesSalud || '',
          fichaMedicaUrl: user?.fichaMedicaUrl || ''
        });
        setPlanSesionesSemana(user?.plan?.sesionesPorSemana || 0);
        setTurnosFijos((user?.TurnosFijos || []).filter(t => t.activo).map(t => ({
          horarioId: t.ID_HorarioClase,
          editing: false,
        })));

      } catch (err) {
        console.error(err);
        toast.error('No se pudo cargar los datos del usuario');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchUser();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleTipoChange = (val) => {
    const tipo = typeof val === 'string' ? val : val.target.value;
    setFormData(f => ({ ...f, tipo }));
  };

  const handleEstadoChange = (val) => {
    const estado = typeof val === 'string'
      ? val === 'Si'
      : val.target.value === 'Si';
    setFormData(f => ({ ...f, estado }));
  };

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) {
      setAvatarFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validación de email tolerante a acentos/Unicode (el type="email" nativo rechaza no-ASCII,
    // y hay usuarios importados con tildes en el mail).
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test((formData.email || '').trim())) {
      toast.error('Ingresá un email válido');
      return;
    }
    setIsLoading(true)
    try {
      const isoFecha = formData.fechaCumple
        ? new Date(formData.fechaCumple).toISOString()
        : '';

      const selectedPlan = planOptions.find(p => p.label === formData.plan);
      if (formData.tipo === 'Cliente' && !formData.dni.trim()) {
        toast.error('Ingresá el DNI del alumno');
        setIsLoading(false);
        return;
      }

      const payload = new FormData();
      payload.append('email', formData.email);
      payload.append('dni', formData.dni);
      payload.append('nombre', formData.nombre);
      payload.append('apellido', formData.apellido);
      payload.append('direc', formData.direc);
      payload.append('tel', formData.tel);
      payload.append('tipo', formData.tipo.toLowerCase());
      payload.append('fechaCumple', isoFecha);
      payload.append('observacionesSalud', formData.observacionesSalud.trim());
      payload.append('fichaMedicaUrl', formData.fichaMedicaUrl.trim());

      if (formData.tipo === 'Cliente' && selectedPlan) {
        payload.append('ID_Plan', selectedPlan.value);
      }

      payload.append('usaTurnosFijos', String(formData.usaTurnosFijos));
      if (formData.tipo === 'Cliente') {
        const uniqueTurnos = turnosFijos.map(t => t.horarioId).filter(Boolean);
        if (formData.usaTurnosFijos && uniqueTurnos.length === 0) {
          toast.error('Seleccioná al menos un turno fijo');
          setIsLoading(false);
          return;
        }
        payload.append('turnosFijos', JSON.stringify(formData.usaTurnosFijos ? uniqueTurnos : []));
      }

      if (formData.tipo === 'Entrenador' && formData.profesion) {
        payload.append('profesion', formData.profesion);
      }

      if (avatarFile) {
        payload.append('avatar', avatarFile);
      }

      await apiService.updateUserById(id, payload);
      setIsLoading(false)
      toast.success('Usuario actualizado correctamente');

      if (fromAdmin) {
        navigate("/admin/usuarios");
      } else {
        navigate("/entrenador/usuarios")
      }
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || 'Error al actualizar usuario';
      setIsLoading(false)
      toast.error(msg);
    }
  };

  return (
      <div className="page-layout">
        {isLoading && <LoaderFullScreen />}
        <SidebarMenu isAdmin={fromAdmin} isEntrenador={fromEntrenador} />
        <div className="content-layout">
          <SecondaryButton
            text="Volver atrás"
            linkTo={fromAdmin ? "/admin/usuarios" : "/entrenador/usuarios"}
            icon={ArrowLeft}
            reversed={true}
          />
          <h2>Editar usuario</h2>
          <form
            onSubmit={handleSubmit}
            className="usuario-form"
          >
            <div className="usuario-form-field">
              <label htmlFor="email">Email</label>
              <CustomInput
                type="text"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="Ingresa tu email"
                width="100%"
              />
            </div>

            <div className="usuario-form-field">
              <label htmlFor="nombre">Nombre</label>
              <CustomInput
                type="text"
                id="nombre"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                placeholder="Ingresa el nombre"
                width="100%"
              />
            </div>

            <div className="usuario-form-field">
              <label htmlFor="dni">DNI</label>
              <CustomInput
                type="text"
                id="dni"
                name="dni"
                value={formData.dni}
                onChange={handleChange}
                placeholder="Ingresa el DNI"
                width="100%"
              />
            </div>

            <div className="usuario-form-field">
              <label htmlFor="apellido">Apellido</label>
              <CustomInput
                type="text"
                id="apellido"
                name="apellido"
                value={formData.apellido}
                onChange={handleChange}
                placeholder="Ingresa el apellido"
                width="100%"
              />
            </div>

            <div className="usuario-form-field">
              <label htmlFor="tipo">Tipo de usuario</label>
              <CustomDropdown
                options={tipos}
                value={formData.tipo}
                onChange={handleTipoChange}
                name="tipo"
                id="tipo"
              />
            </div>

            {formData.tipo === 'Cliente' && (
              <div className="usuario-form-field usuario-form-field--full">
                <label htmlFor="plan">Plan</label>
                <CustomDropdown
                  options={planOptions.map(p => p.label)}
                  value={formData.plan}
                  onChange={e => {
                    const label = e.target.value;
                    const selected = planOptions.find(p => p.label === label);
                    setPlanSesionesSemana(selected?.sesionesPorSemana || 0);
                    setFormData(f => ({
                      ...f,
                      plan: label
                    }))
                  }}
                  name="plan"
                  id="plan"
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

            {formData.tipo === 'Entrenador' && (
              <div className="usuario-form-field">
                <label htmlFor="profesion">Profesión</label>
                <CustomInput
                  type="text"
                  id="profesion"
                  name="profesion"
                  value={formData.profesion}
                  onChange={handleChange}
                  placeholder="Ingresa la profesión"
                  width="100%"
                />
              </div>
            )}

            <div className="usuario-form-field">
              <label htmlFor="direc">Dirección</label>
              <CustomInput
                type="text"
                id="direc"
                name="direc"
                value={formData.direc}
                onChange={handleChange}
                placeholder="Ingresa la dirección"
                width="100%"
              />
            </div>

            <div className="usuario-form-field">
              <label htmlFor="tel">Teléfono</label>
              <CustomInput
                type="tel"
                id="tel"
                name="tel"
                value={formData.tel}
                onChange={handleChange}
                placeholder="Ingresa el teléfono"
                width="100%"
              />
            </div>

            {/* <div className="form-field">
              <label htmlFor="estado">Activo:</label>
              <CustomDropdown
                options={opcionesEstado}
                value={formData.estado ? 'Si' : 'No'}
                onChange={handleEstadoChange}
                name="estado"
                id="estado"
              />
            </div> */}

            <div className="usuario-form-field">
              <label htmlFor="fechaCumple">Fecha de nacimiento</label>
              <CustomInput
                type="date"
                id="fechaCumple"
                name="fechaCumple"
                value={formData.fechaCumple}
                onChange={handleChange}
                width="100%"
              />
            </div>

            <div className="usuario-form-field">
              <label htmlFor="fichaMedicaUrl">Ficha médica</label>
              <CustomInput
                type="text"
                id="fichaMedicaUrl"
                name="fichaMedicaUrl"
                value={formData.fichaMedicaUrl}
                onChange={handleChange}
                placeholder="URL de la ficha médica"
                width="100%"
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
                className="usuario-form-textarea"
                rows={5}
              />
            </div>

            <div className="usuario-form-field">
              <label htmlFor="avatar">Avatar</label>
              <input
                type="file"
                id="avatar"
                name="avatar"
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>

            <div className="usuario-form-actions">
              <button type="submit" className="primary-button" disabled={isLoading}>
                Actualizar usuario
              </button>
            </div>
          </form>
        </div>
      </div>
  );
};

export default EditarUsuario;
