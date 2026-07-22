import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import '../../../App.css';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton';
import { ReactComponent as ArrowLeftIcon } from '../../../assets/icons/arrow-left.svg';
import './clasesActividadesDetalle.css'
import apiClient from '../../../axiosConfig';

const ClasesActividadesDetalle = () => {
    const { id } = useParams();
    const [claseDetalle, setClaseDetalle] = useState(null);
    const defaultAvatar = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRGh5WFH8TOIfRKxUrIgJZoDCs1yvQ4hIcppw&s";

    useEffect(() => {
        const fetchClaseDetalle = async () => {
            try {
                const response = await apiClient.get(`/clase/horario/${id}`);
                console.log(response.data);
                setClaseDetalle(response.data);
            } catch (error) {
                console.error("Error al obtener los detalles de la clase:", error);
            }
        };

        fetchClaseDetalle();
    }, [id]);

    if (!claseDetalle) {
        return (
            <div className='page-layout'>
                <SidebarMenu isAdmin={false} />
                <div className='content-layout'>
                    <p>Cargando detalles de la clase...</p>
                </div>
            </div>
        );
    }

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
            <SidebarMenu isAdmin={false} />
            <div className='content-layout'>
                <div className="clases-actividades-detalle-ctn">
                    <div className="clases-actividades-detalle-title">
                        <SecondaryButton
                            text="Clases y actividades"
                            linkTo="/alumno/clases-actividades"
                            icon={ArrowLeftIcon}
                            reversed={true}
                        />
                        {/* style={{ backgroundImage: `url(${claseDetalle.imagen})`}} */}
                        <div className="clases-actividades-detalle-title-img" style={{
                            backgroundImage: `url(${claseDetalle.imagenClase != null
                                ? claseDetalle.imagenClase
                                : 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dGhlJTIwZ3ltfGVufDB8fDB8fHww'})`
                        }}>
                            <h2>{claseDetalle.nombre}</h2>
                        </div>
                    </div>
                    <div className="clases-actividades-detalle-info">
                        <div className="clases-actividades-item clases-actividades-detalle-info-descripcion">
                            <h3> Descripción </h3>
                            <p> {claseDetalle.descripcion}</p>
                        </div>
                        <div className="clases-actividades-item clases-actividades-detalle-info-horario">
                            <h3> Horarios </h3>
                            {hasHorarios ? (
                                <div className="horarios-calendario">
                                    <div className="horarios-calendario-header">
                                        <span>Calendario semanal</span>
                                        <small>Elegí un horario para sacar turno</small>
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
                                                                <Link
                                                                    key={horario.ID_HorarioClase}
                                                                    to="/alumno/agendar-turno"
                                                                    state={{
                                                                        selectedClaseId: claseDetalle.ID_Clase,
                                                                        selectedClaseNombre: claseDetalle.nombre,
                                                                        selectedHorarioId: horario.ID_HorarioClase,
                                                                    }}
                                                                    className="horarios-calendario-evento"
                                                                    style={getEventoStyle(horario)}
                                                                >
                                                                    <span className="horarios-calendario-evento-hora">{formatHorario(horario)}</span>
                                                                    <span className="horarios-calendario-evento-nombre">{claseDetalle.nombre}</span>
                                                                    <span className="horarios-calendario-evento-cupos">{formatCupos(horario)}</span>
                                                                </Link>
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
                                                        <Link
                                                            key={horario.ID_HorarioClase}
                                                            to="/alumno/agendar-turno"
                                                            state={{
                                                                selectedClaseId: claseDetalle.ID_Clase,
                                                                selectedClaseNombre: claseDetalle.nombre,
                                                                selectedHorarioId: horario.ID_HorarioClase,
                                                            }}
                                                            className="horarios-mobile-evento"
                                                        >
                                                            <strong>{formatHorario(horario)}</strong>
                                                            <small>{formatCupos(horario)}</small>
                                                        </Link>
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
                            <h3>Instructores</h3>
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
        </div>
    );
};

export default ClasesActividadesDetalle;
