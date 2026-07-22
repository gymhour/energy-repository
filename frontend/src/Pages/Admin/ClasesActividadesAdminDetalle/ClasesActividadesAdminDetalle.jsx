import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../../../App.css';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton';
import ConfirmationPopup from '../../../Components/utils/ConfirmationPopUp/ConfirmationPopUp';
import { toast } from "react-toastify";
import { ArrowLeft } from 'lucide-react';
import apiClient from '../../../axiosConfig';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import '../../Alumno/ClasesActividadesDetalle/clasesActividadesDetalle.css';

const ClasesActividadesAdminDetalle = ({ fromAdmin, fromEntrenador }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [claseDetalle, setClaseDetalle] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const defaultAvatar = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRGh5WFH8TOIfRKxUrIgJZoDCs1yvQ4hIcppw&s";
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchClaseDetalle = async () => {
      try {
        const response = await apiClient.get(`/clase/horario/${id}`);
        setClaseDetalle(response.data);
      } catch (error) {
        console.error("Error al obtener los detalles de la clase:", error);
      }
    };
    fetchClaseDetalle();
  }, [id]);

  const deleteClase = async () => {
    setLoading(true);
    try {
      await apiClient.delete(`/clase/horario/${id}`);
      toast.success("Clase eliminada correctamente.");
      navigate("/admin/clases-actividades");
      setLoading(false);
    } catch (error) {
      setLoading(false)
      toast.error("Hubo un error al eliminar la clase.");
      console.error('Error al eliminar la clase - ClasesActividadesAdminDetalle.jsx', error);
    }
  };

  const handleDeleteClick = () => setIsPopupOpen(true);
  const handlePopupConfirm = () => {
    setIsPopupOpen(false);
    deleteClase();
  };
  const handlePopupClose = () => setIsPopupOpen(false);

  if (!claseDetalle) {
    return (
      <div className='page-layout'>
        <SidebarMenu isAdmin={fromAdmin} isEntrenador={fromEntrenador} />
        <div className='content-layout'>
          <p>Cargando detalles de la clase...</p>
        </div>
      </div>
    );
  }

  // Permito editar al admin o a los entrenadores que dan la clase
  const usuarioId = Number(localStorage.getItem("usuarioId"));
  const isEntrenadorClase = claseDetalle.Entrenadores
    .some(ent => ent.ID_Usuario === usuarioId);
  const canEdit = fromAdmin || isEntrenadorClase;

  const isActive = (val) => val === true || val === 1 || val === '1' || val === 'true';
  const horariosActivos = (claseDetalle?.HorariosClase ?? []).filter(h => isActive(h?.activo));

  const calendarioDias = [
    { key: 'lunes', label: 'Lunes' },
    { key: 'martes', label: 'Martes' },
    { key: 'miercoles', label: 'Miércoles' },
    { key: 'jueves', label: 'Jueves' },
    { key: 'viernes', label: 'Viernes' },
    { key: 'sabado', label: 'Sábado' },
    { key: 'domingo', label: 'Domingo' },
  ];

  const normalizeDia = (dia) => dia
    ?.toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const getHorarioParts = (value) => {
    if (!value) return { hours: 0, minutes: 0, label: '--:--' };
    const str = value.toString();

    if (str.includes('T')) {
      const date = new Date(str);
      const hours = date.getUTCHours();
      const minutes = date.getUTCMinutes();
      return {
        hours,
        minutes,
        label: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      };
    }

    const [rawHours = '0', rawMinutes = '0'] = str.split(':');
    const hours = Number(rawHours);
    const minutes = Number(rawMinutes);
    return {
      hours,
      minutes,
      label: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    };
  };

  const formatHorario = (horario) => `${getHorarioParts(horario.horaIni).label} - ${getHorarioParts(horario.horaFin).label}`;
  const formatCupos = (horario) => (
    typeof horario.cuposUsados === 'number'
      ? `${horario.cuposUsados}/${horario.cupos} usados`
      : `${horario.cupos} cupos`
  );

  const horariosPorDia = horariosActivos.reduce((acc, curr) => {
    const dia = normalizeDia(curr.diaSemana);
    if (!acc[dia]) acc[dia] = [];
    acc[dia].push(curr);
    return acc;
  }, {});

  calendarioDias.forEach(({ key: dia }) => {
    if (!horariosPorDia[dia]) return;
    horariosPorDia[dia].sort((a, b) => {
      const timeA = getHorarioParts(a.horaIni);
      const timeB = getHorarioParts(b.horaIni);
      return (timeA.hours * 60 + timeA.minutes) - (timeB.hours * 60 + timeB.minutes);
    });
  });

  const hasHorarios = horariosActivos.length > 0;
  const hourHeight = 72;

  const getHorarioMinutes = (horario) => {
    const start = getHorarioParts(horario.horaIni);
    const end = getHorarioParts(horario.horaFin);
    const startMinutes = start.hours * 60 + start.minutes;
    const rawEndMinutes = end.hours * 60 + end.minutes;

    return {
      startMinutes,
      endMinutes: rawEndMinutes > startMinutes ? rawEndMinutes : startMinutes + 60,
    };
  };

  const horariosMinutes = horariosActivos.map(getHorarioMinutes);
  const calendarStartHour = hasHorarios
    ? Math.max(0, Math.floor(Math.min(...horariosMinutes.map(h => h.startMinutes)) / 60) - 1)
    : 7;
  const calendarEndHour = hasHorarios
    ? Math.min(24, Math.ceil(Math.max(...horariosMinutes.map(h => h.endMinutes)) / 60) + 1)
    : 22;
  const calendarHours = Array.from(
    { length: calendarEndHour - calendarStartHour + 1 },
    (_, index) => calendarStartHour + index
  );
  const calendarHeight = (calendarEndHour - calendarStartHour) * hourHeight;

  const getEventoStyle = (horario) => {
    const { startMinutes, endMinutes } = getHorarioMinutes(horario);
    const top = ((startMinutes - calendarStartHour * 60) / 60) * hourHeight;
    const height = Math.max(((endMinutes - startMinutes) / 60) * hourHeight, 64);

    return {
      top: `${top}px`,
      height: `${height}px`,
    };
  };

  return (
    <div className='page-layout'>
      {loading && <LoaderFullScreen />}
      <SidebarMenu isAdmin={fromAdmin} isEntrenador={fromEntrenador} />
      <div className='content-layout'>
        <div className="clases-actividades-detalle-ctn">
          <div className="clases-actividades-detalle-title">
            <div className='clases-actividades-detalle-actions'>
              <SecondaryButton
                text="Clases y actividades"
                linkTo={fromAdmin ? "/admin/clases-actividades" : "/entrenador/clases-actividades"}
                icon={ArrowLeft}
                reversed={true}
              />
              <div className='clases-actividades-detalle-actions-edit-delete'>
                {canEdit && (
                  <PrimaryButton
                    text="Editar clase"
                    linkTo={
                      fromAdmin
                        ? `/admin/editar-clase/${id}`
                        : `/entrenador/editar-clase/${id}`
                    }
                  />
                )
                }
                {
                  fromAdmin && <SecondaryButton text="Eliminar clase" onClick={handleDeleteClick} />
                }
              </div>
            </div>
            <div
              className="clases-actividades-detalle-title-img"
              style={{
                backgroundImage: `url(${claseDetalle.imagenClase != null
                  ? claseDetalle.imagenClase
                  : 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dGhlJTIwZ3ltfGVufDB8fDB8fHww'
                  })`
              }}
            >
              <h2>{claseDetalle.nombre}</h2>
            </div>
          </div>

          <div className="clases-actividades-detalle-info">
            {/* Descripción */}
            <div className="clases-actividades-item clases-actividades-detalle-info-descripcion">
              <h2>Descripción</h2>
              <p>{claseDetalle.descripcion}</p>
            </div>

            <div className="clases-actividades-item clases-actividades-detalle-info-horario">
              <h2>Horarios</h2>
              {hasHorarios ? (
                <div className="horarios-calendario">
                  <div className="horarios-calendario-header">
                    <span>Calendario semanal</span>
                    <small>Vista de horarios y cupos</small>
                  </div>
                  <div className="horarios-calendario-scroll">
                    <div className="horarios-calendario-tabla">
                      <div className="horarios-calendario-top">
                        <div className="horarios-calendario-corner"></div>
                        {calendarioDias.map((dia) => (
                          <div key={dia.key} className="horarios-calendario-dia-titulo">
                            <span>{dia.label}</span>
                            <small>
                              {(horariosPorDia[dia.key] ?? []).length || 'Sin'} {(horariosPorDia[dia.key] ?? []).length === 1 ? 'clase' : 'clases'}
                            </small>
                          </div>
                        ))}
                      </div>
                      <div className="horarios-calendario-body">
                        <div className="horarios-calendario-horas" style={{ height: `${calendarHeight}px` }}>
                          {calendarHours.slice(0, -1).map((hour) => (
                            <span
                              key={hour}
                              className="horarios-calendario-hora"
                              style={{ top: `${(hour - calendarStartHour) * hourHeight}px` }}
                            >
                              {String(hour).padStart(2, '0')}:00
                            </span>
                          ))}
                        </div>
                        <div className="horarios-calendario-columnas">
                          {calendarioDias.map((dia) => (
                            <div
                              key={dia.key}
                              className="horarios-calendario-columna"
                              style={{ height: `${calendarHeight}px` }}
                            >
                              {calendarHours.slice(0, -1).map((hour) => (
                                <span
                                  key={hour}
                                  className="horarios-calendario-linea"
                                  style={{ top: `${(hour - calendarStartHour) * hourHeight}px` }}
                                />
                              ))}
                              {(horariosPorDia[dia.key] ?? []).map((horario) => (
                                <div
                                  key={horario.ID_HorarioClase}
                                  className="horarios-calendario-evento horarios-calendario-evento-no-link"
                                  style={getEventoStyle(horario)}
                                >
                                  <span className="horarios-calendario-evento-hora">{formatHorario(horario)}</span>
                                  <span className="horarios-calendario-evento-nombre">{claseDetalle.nombre}</span>
                                  <span className="horarios-calendario-evento-cupos">{formatCupos(horario)}</span>
                                </div>
                              ))}
                              {(horariosPorDia[dia.key] ?? []).length === 0 && (
                                <span className="horarios-calendario-vacio">Sin clases</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="horarios-calendario-mobile-list">
                    {calendarioDias.map((dia) => (
                      <div key={dia.key} className="horarios-mobile-dia">
                        <span>{dia.label}</span>
                        {(horariosPorDia[dia.key] ?? []).length > 0 ? (
                          (horariosPorDia[dia.key] ?? []).map((horario) => (
                            <div
                              key={horario.ID_HorarioClase}
                              className="horarios-mobile-evento horarios-mobile-evento-no-link"
                            >
                              <strong>{formatHorario(horario)}</strong>
                              <small>{formatCupos(horario)}</small>
                            </div>
                          ))
                        ) : (
                          <small>Sin clases</small>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p>No hay horarios disponibles.</p>
              )}
            </div>

            {/* Instructores */}
            <div className="clases-actividades-item clases-actividades-detalle-info-instructores">
              <h2>Instructores</h2>
              {claseDetalle.Entrenadores && claseDetalle.Entrenadores.length > 0 ? (
                <ul className='listado-entrenadores'>
                  {claseDetalle.Entrenadores.map(ent => (
                    <li key={ent.ID_Usuario}>
                      <div className="usuarios-table-userimage" style={{
                        backgroundImage: `url(${ent.imagenUsuario ? ent.imagenUsuario : defaultAvatar})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat'
                      }}></div>
                      {ent.nombre} {ent.apellido} {ent.profesion && `– ${ent.profesion}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No hay instructores asignados.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationPopup
        isOpen={isPopupOpen}
        onClose={handlePopupClose}
        onConfirm={handlePopupConfirm}
        message="¿Estás seguro de que deseas eliminar esta clase?"
      />
    </div>
  );
};

export default ClasesActividadesAdminDetalle;
