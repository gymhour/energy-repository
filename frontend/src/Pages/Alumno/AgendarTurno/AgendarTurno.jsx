import React, { useState, useEffect, useMemo } from 'react';
import '../../../App.css';
import './agendarTurno.css';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import { useLocation } from 'react-router-dom';
import apiService from '../../../services/apiService';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import { toast } from 'react-toastify';
import { CalendarDays, CheckCircle2, Clock3, Dumbbell, Rows3, UsersRound } from 'lucide-react';

const DAY_MS = 24 * 60 * 60 * 1000;

// ————————————————————————————————————————————————
// Día → índice (tolerante a tildes y mayúsculas)
// ————————————————————————————————————————————————
const diaIndex = (nombre) => {
  if (!nombre) return null;
  const t = nombre
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')                // separa diacríticos
    .replace(/[\u0300-\u036f]/g, ''); // quita diacríticos

  switch (t) {
    case 'domingo':   return 0;
    case 'lunes':     return 1;
    case 'martes':    return 2;
    case 'miercoles': return 3; // cubre "Miércoles" y "Miercoles"
    case 'jueves':    return 4;
    case 'viernes':   return 5;
    case 'sabado':    return 6; // cubre "Sábado" y "Sabado"
    default:          return null;
  }
};

const getHorarioDateParts = (value) => {
  if (!value) return { hours: 0, minutes: 0 };
  const str = value.toString();

  if (str.includes('T')) {
    const date = new Date(str);
    return {
      hours: date.getUTCHours(),
      minutes: date.getUTCMinutes(),
    };
  }

  const [rawHours = '0', rawMinutes = '0'] = str.split(':');
  return {
    hours: Number(rawHours),
    minutes: Number(rawMinutes),
  };
};

const getNextDateForHorario = (horario) => {
  const targetDay = diaIndex(horario?.diaSemana);
  if (targetDay === null) return null;

  const now = new Date();
  const selected = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offset = (targetDay - selected.getDay() + 7) % 7;
  const { hours, minutes } = getHorarioDateParts(horario.horaIni);

  selected.setDate(selected.getDate() + offset);
  selected.setHours(hours, minutes, 0, 0);

  if (selected <= now) {
    selected.setDate(selected.getDate() + 7);
  }

  return selected;
};

const formatHorarioTime = (value) => {
  const { hours, minutes } = getHorarioDateParts(value);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getDateWithHorarioTime = (date, horario, field = 'horaIni') => {
  const next = new Date(date);
  const { hours, minutes } = getHorarioDateParts(horario?.[field]);
  next.setHours(hours, minutes, 0, 0);
  return next;
};

const formatDayLabel = (date) => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()).getTime();

  if (dateOnly === todayOnly) return 'Hoy';
  if (dateOnly === tomorrowOnly) return 'Mañana';

  return date.toLocaleDateString('es-AR', { weekday: 'long' });
};

const formatDateLabel = (date) => (
  date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', '')
);

const formatFullDateLabel = (date) => (
  date.toLocaleDateString('es-AR', { day: '2-digit', month: 'long' })
);

const parseApiDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDateOnly = (date) => (
  new Date(date.getFullYear(), date.getMonth(), date.getDate())
);

const getCuotaEndDate = (cuota) => (
  parseApiDate(cuota?.fechaFin) || parseApiDate(cuota?.vence)
);

const getCuotaStartDate = (cuota) => (
  parseApiDate(cuota?.fechaInicio)
);

const findCurrentCuota = (cuotas) => {
  const todayOnly = getDateOnly(new Date());

  return (cuotas || []).find((cuota) => {
    const startDate = getCuotaStartDate(cuota);
    const endDate = getCuotaEndDate(cuota);
    if (!endDate) return false;

    const startOnly = startDate ? getDateOnly(startDate) : null;
    const endOnly = getDateOnly(endDate);
    return (!startOnly || startOnly <= todayOnly) && endOnly >= todayOnly;
  }) || null;
};

const getInclusiveDaysBetween = (fromDate, toDate) => {
  if (!fromDate || !toDate) return 0;
  const fromOnly = getDateOnly(fromDate);
  const toOnly = getDateOnly(toDate);
  return Math.max(0, Math.floor((toOnly.getTime() - fromOnly.getTime()) / DAY_MS) + 1);
};

const isDateWithinReservationWindow = (date, reservationEndDate) => {
  if (!date || !reservationEndDate) return false;
  const todayOnly = getDateOnly(new Date());
  const dateOnly = getDateOnly(date);
  const maxDateOnly = getDateOnly(reservationEndDate);
  return dateOnly >= todayOnly && dateOnly <= maxDateOnly;
};

const normalizeCuotasResponse = (res) => (
  Array.isArray(res) ? res
    : Array.isArray(res?.data) ? res.data
      : Array.isArray(res?.data?.data) ? res.data.data
        : []
);

const getCuposInfo = (horario) => {
  const total = Number(horario?.cupos ?? horario?.capacidad ?? 0);
  const usedSource = [
    horario?.cuposUsados,
    horario?.turnosTomados,
    horario?.turnosActivos,
    horario?.reservasActivas,
    Array.isArray(horario?.activeUsers) ? horario.activeUsers.length : undefined,
  ].find((value) => Number.isFinite(Number(value)));

  const used = Number.isFinite(Number(usedSource)) ? Number(usedSource) : null;
  const available = total > 0 && used !== null ? Math.max(total - used, 0) : null;
  const percent = total > 0 && used !== null ? Math.min(Math.round((used / total) * 100), 100) : 0;
  const isFull = total > 0 && used !== null && used >= total;

  return { total, used, available, percent, isFull };
};

const AgendarTurno = () => {
  const location = useLocation();
  const [clases, setClases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedClase, setSelectedClase] = useState('');
  const [selectedDateTime, setSelectedDateTime] = useState(null);
  const [selectedDayDate, setSelectedDayDate] = useState(null);
  const [isAgendando, setIsAgendando] = useState(false);
  const [preselectionApplied, setPreselectionApplied] = useState(false);
  const [cuotas, setCuotas] = useState([]);
  // Cupos calculados por fecha concreta (clave: `${ID_HorarioClase}__${fechaISO}`).
  // Necesario porque el listado de clases solo trae los cupos de la próxima ocurrencia,
  // y el alumno puede elegir fechas de semanas siguientes.
  const [cuposByFecha, setCuposByFecha] = useState({});

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const usuarioId = localStorage.getItem("usuarioId");
        const [clasesApi, cuotasRes] = await Promise.all([
          apiService.getClases(),
          usuarioId ? apiService.getCuotasUsuario(usuarioId) : Promise.resolve([]),
        ]);

        setClases(clasesApi);
        setCuotas(normalizeCuotasResponse(cuotasRes));
      } catch (err) {
        toast.error("Error al cargar los datos de agenda. Intente nuevamente.");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const cuotaVigente = useMemo(() => findCurrentCuota(cuotas), [cuotas]);
  const reservationEndDate = useMemo(() => getCuotaEndDate(cuotaVigente), [cuotaVigente]);

  useEffect(() => {
    if (preselectionApplied || clases.length === 0 || !location.state) return;

    const { selectedClaseId, selectedClaseNombre, selectedHorarioId } = location.state;
    const clasePreseleccionada = clases.find((clase) => {
      const matchesId = selectedClaseId && Number(clase.ID_Clase) === Number(selectedClaseId);
      const matchesName = selectedClaseNombre && clase.nombre === selectedClaseNombre;
      return matchesId || matchesName;
    });

    if (!clasePreseleccionada) {
      setPreselectionApplied(true);
      return;
    }

    setSelectedClase(clasePreseleccionada.nombre);

    const horarioPreseleccionado = (clasePreseleccionada.HorariosClase ?? []).find(
      (horario) => Number(horario.ID_HorarioClase) === Number(selectedHorarioId)
    );

    if (horarioPreseleccionado) {
      const preselectedDate = getNextDateForHorario(horarioPreseleccionado);
      if (isDateWithinReservationWindow(preselectedDate, reservationEndDate)) {
        setSelectedDateTime(preselectedDate);
        setSelectedDayDate(preselectedDate);
      }
    }

    setPreselectionApplied(true);
  }, [clases, location.state, preselectionApplied, reservationEndDate]);

  const selectedClaseData = clases.find((clase) => clase.nombre === selectedClase);

  // Filtra fechas: hoy hasta el fin de la cuota vigente y días permitidos según horarios ACTIVOS
  const filterDate = (date) => {
    if (!reservationEndDate) return false;

    const now = new Date();

    const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (!isDateWithinReservationWindow(dateOnly, reservationEndDate)) {
      return false;
    }

    if (selectedClase) {
      const clase = clases.find(c => c.nombre === selectedClase);
      if (!clase) return false;

      const activos = (clase.HorariosClase ?? []).filter(h => h.activo !== false);
      if (activos.length === 0) return false;

      const allowedDays = activos
        .map(h => diaIndex(h.diaSemana))
        .filter(d => d !== null);

      if (!allowedDays.includes(date.getDay())) return false;

      // Si es hoy, asegurar que haya al menos un horario futuro
      if (dateOnly.getTime() === todayOnly.getTime()) {
        const hasFutureSlot = activos.some(h => {
          const { hours, minutes } = getHorarioDateParts(h.horaIni);
          const localStart = new Date(dateOnly);
          // Usamos las horas/min de UTCHours como "hora de pared"
          localStart.setHours(hours, minutes, 0, 0);
          return localStart > now;
        });
        return hasFutureSlot;
      }
      return true;
    }

    return true;
  };

  // Genera todos los horarios permitidos para el día seleccionado (uno por cada horario ACTIVO)
  const getAllowedHorarioSlots = (date) => {
    if (!date || !selectedClase) return [];
    const dia = date.getDay();
    const clase = clases.find(c => c.nombre === selectedClase);
    if (!clase) return [];

    const horariosDia = (clase.HorariosClase ?? [])
      .filter(h => h.activo !== false && diaIndex(h.diaSemana) === dia);

    if (horariosDia.length === 0) return [];

    const now = new Date();
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const isToday = dateOnly.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const allowedSlots = horariosDia
      .map(h => {
        const start = getDateWithHorarioTime(date, h, 'horaIni');
        const end = getDateWithHorarioTime(date, h, 'horaFin');
        return { horario: h, start, end };
      })
      .filter(slot => !isToday || slot.start > now) // si es hoy, solo futuros
      .sort((a, b) => a.start - b.start);

    return allowedSlots;
  };

  // Helper para formatear fecha local como ISO sin zona (mantiene tu comportamiento)
  const formatLocalISO = (date) => {
    const pad = n => String(n).padStart(2, '0');
    return [
      date.getFullYear(),
      '-', pad(date.getMonth() + 1),
      '-', pad(date.getDate()),
      'T', pad(date.getHours()),
      ':', pad(date.getMinutes()),
      ':', pad(date.getSeconds())
    ].join('');
  };

  const slotCuposKey = (horario, start) => `${horario?.ID_HorarioClase}__${formatLocalISO(start)}`;

  // Resuelve los cupos de un slot para su fecha concreta. Usa el valor traído por fecha
  // si ya está disponible; si todavía no llegó, cae al valor de la próxima ocurrencia.
  const getSlotCupos = (horario, start) => {
    const fetched = cuposByFecha[slotCuposKey(horario, start)];
    if (fetched && !fetched.error && fetched.cupos !== undefined) {
      const total = Number(fetched.cupos ?? 0);
      const used = Number(fetched.cuposUsados ?? 0);
      const available = total > 0 ? Math.max(total - used, 0) : null;
      const percent = total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0;
      const isFull = total > 0 && used >= total;
      return { total, used, available, percent, isFull };
    }
    return getCuposInfo(horario);
  };

  const manejarSeleccionClase = (e) => {
    const nombreClaseSeleccionada = e?.target?.value ?? e;
    setSelectedClase(nombreClaseSeleccionada);
    setSelectedDateTime(null); // reiniciamos al cambiar de clase
    setSelectedDayDate(null);
  };

  // Al elegir un día, pedimos la disponibilidad real de cada horario para esa fecha exacta.
  useEffect(() => {
    const day = selectedDayDate || selectedDateTime;
    if (!day || !selectedClase) return;

    const slots = getAllowedHorarioSlots(day);
    if (slots.length === 0) return;

    let cancelled = false;
    Promise.all(slots.map(async ({ horario, start }) => {
      const fechaISO = formatLocalISO(start);
      try {
        const data = await apiService.getHorarioCupos(horario.ID_HorarioClase, fechaISO);
        return { key: slotCuposKey(horario, start), data };
      } catch {
        return { key: slotCuposKey(horario, start), data: null };
      }
    })).then((results) => {
      if (cancelled) return;
      setCuposByFecha((prev) => {
        const next = { ...prev };
        results.forEach(({ key, data }) => { if (data) next[key] = data; });
        return next;
      });
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDayDate, selectedDateTime, selectedClase]);

  const getAvailableDays = () => {
    if (!selectedClase || !reservationEndDate) return [];

    const daysToShow = getInclusiveDaysBetween(new Date(), reservationEndDate);
    return Array.from({ length: daysToShow }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index);
      date.setHours(0, 0, 0, 0);
      const slots = filterDate(date) ? getAllowedHorarioSlots(date) : [];
      return { date, slots };
    }).filter((day) => day.slots.length > 0);
  };

  const availableDays = getAvailableDays();
  const selectedDay = selectedDateTime
    ? availableDays.find(({ date }) => date.toDateString() === selectedDateTime.toDateString())
    : selectedDayDate
      ? availableDays.find(({ date }) => date.toDateString() === selectedDayDate.toDateString())
    : null;
  const selectedSlots = selectedDay?.slots ?? [];
  const selectedSlot = selectedDateTime
    ? selectedSlots.find(({ start }) => start.getTime() === selectedDateTime.getTime())
    : null;
  const selectedCupos = selectedSlot ? getSlotCupos(selectedSlot.horario, selectedSlot.start) : null;
  const resumenSeleccion = selectedClase && selectedDateTime
    ? `${selectedClase} · ${selectedDateTime.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })} ${selectedDateTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
    : selectedClase && selectedDay
      ? `${selectedClase} · ${selectedDay.date.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}`
      : 'Elegí clase y horario';

  const manejarAgendarTurno = async () => {
    // Validaciones sin activar loader para no “pegar” la UI en errores tempranos
    if (!selectedClase || !selectedDateTime) {
      toast.error("Por favor, selecciona una clase y un turno (fecha y hora) disponibles.");
      return;
    }

    if (!reservationEndDate || !filterDate(selectedDateTime)) {
      toast.error("La fecha seleccionada está fuera de la vigencia de tu cuota.");
      return;
    }

    const usuarioId = localStorage.getItem("usuarioId");
    if (!usuarioId) {
      toast.error("Usuario no autenticado.");
      return;
    }

    const claseSeleccionada = clases.find((clase) => clase.nombre === selectedClase);
    if (!claseSeleccionada) {
      toast.error("Clase seleccionada no válida.");
      return;
    }

    const day = selectedDateTime.getDay();
    // Horarios activos del mismo día
    const horariosMismoDia = (claseSeleccionada.HorariosClase ?? [])
      .filter(h => h.activo !== false && diaIndex(h.diaSemana) === day);

    if (horariosMismoDia.length === 0) {
      toast.error("No hay horario disponible para ese día.");
      return;
    }

    // Encontrar el horario cuyo "inicio" coincide con la hora elegida en el picker
    // (misma lógica de hora local = UTCHours/UTCMinutes)
    const horarioElegido = horariosMismoDia.find(h => {
      const { hours: hh, minutes: mm } = getHorarioDateParts(h.horaIni);
      return (hh === selectedDateTime.getHours() && mm === selectedDateTime.getMinutes());
    });

    if (!horarioElegido) {
      toast.error("No pudimos identificar el horario seleccionado. Probá elegir nuevamente la hora.");
      return;
    }

    const body = {
      ID_Usuario: parseInt(usuarioId, 10),
      ID_HorarioClase: horarioElegido.ID_HorarioClase,
      fecha: formatLocalISO(selectedDateTime),
    };

    setIsAgendando(true);
    setLoading(true);
    try {
      console.log("body que envio", body);
      await apiService.postTurno(body);
      setSelectedClase('');
      setSelectedDateTime(null);
      setSelectedDayDate(null);
      toast.success("Turno agendado exitosamente.");
    } catch (err) {
      console.log(err);
      toast.error(err?.message || "No se pudo agendar el turno.");
    } finally {
      setIsAgendando(false);
      setLoading(false);
    }
  };

  return (
    <div className='page-layout'>
      {loading && <LoaderFullScreen />}
      <SidebarMenu isAdmin={false} />
      <div className='content-layout'>
        <h2 className='agendar-turno-title'>Agendar turno</h2>
        <div className="agendar-turno-ctn">
          <section className="agendar-step agendar-step-clases">
            <div className="agendar-step-header">
              <div>
                <span className="agendar-step-kicker">Paso 1</span>
                <h3>Elegí una clase</h3>
              </div>
              <Rows3 size={22} aria-hidden="true" />
            </div>

            {!loading && (
              <div className="agendar-clases-grid">
                {clases.map((clase) => {
                  const horariosActivos = (clase.HorariosClase ?? []).filter(h => h.activo !== false);
                  const isSelected = selectedClase === clase.nombre;

                  return (
                    <button
                      key={clase.ID_Clase ?? clase.nombre}
                      type="button"
                      className={`agendar-clase-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => manejarSeleccionClase(clase.nombre)}
                    >
                      <span className="agendar-clase-icon">
                        {isSelected ? <CheckCircle2 size={18} /> : <Dumbbell size={18} />}
                      </span>
                      <strong>{clase.nombre}</strong>
                      <small>{horariosActivos.length} {horariosActivos.length === 1 ? 'horario activo' : 'horarios activos'}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className={`agendar-step agendar-step-turnos ${!selectedClase ? 'is-disabled' : ''}`}>
            <div className="agendar-step-header">
              <div>
                <span className="agendar-step-kicker">Paso 2</span>
                <h3>Seleccioná día y horario</h3>
              </div>
              <CalendarDays size={22} aria-hidden="true" />
            </div>

            {!cuotaVigente ? (
              <div className="agendar-empty-state">
                <Clock3 size={22} aria-hidden="true" />
                <p>No encontramos una cuota vigente para reservar turnos.</p>
              </div>
            ) : !selectedClase ? (
              <div className="agendar-empty-state">
                <Clock3 size={22} aria-hidden="true" />
                <p>Primero seleccioná una clase para ver turnos disponibles hasta el {formatFullDateLabel(reservationEndDate)}.</p>
              </div>
            ) : availableDays.length === 0 ? (
              <div className="agendar-empty-state">
                <Clock3 size={22} aria-hidden="true" />
                <p>No hay turnos disponibles para {selectedClase} hasta el {formatFullDateLabel(reservationEndDate)}.</p>
              </div>
            ) : (
              <>
                <div className="agendar-days-strip" role="list" aria-label="Días disponibles">
                  {availableDays.map(({ date, slots }) => {
                    const isSelected = selectedDay?.date.toDateString() === date.toDateString();

                    return (
                      <button
                        key={date.toISOString()}
                        type="button"
                        className={`agendar-day-card ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => {
                          setSelectedDayDate(isSelected ? null : date);
                          setSelectedDateTime(null);
                        }}
                      >
                        <span>{formatDayLabel(date)}</span>
                        <strong>{formatDateLabel(date)}</strong>
                        <small>{slots.length} {slots.length === 1 ? 'horario' : 'horarios'}</small>
                      </button>
                    );
                  })}
                </div>

                {selectedDay ? (
                  <div className="agendar-slots-panel">
                    <div className="agendar-slots-heading">
                      <div>
                        <span>{selectedClaseData?.nombre}</span>
                        <strong>{`${formatDayLabel(selectedDay.date)}, ${formatDateLabel(selectedDay.date)}`}</strong>
                      </div>
                      <UsersRound size={20} aria-hidden="true" />
                    </div>

                    <div className="agendar-slots-grid">
                      {selectedSlots.map(({ horario, start, end }) => {
                        const cuposInfo = getSlotCupos(horario, start);
                        const isSelected = selectedDateTime?.getTime() === start.getTime();
                        const availabilityLabel = cuposInfo.total > 0 && cuposInfo.used !== null
                          ? `${cuposInfo.available} libres de ${cuposInfo.total}`
                          : `${cuposInfo.total || 'Cupos'} a confirmar`;

                        return (
                          <button
                            key={`${horario.ID_HorarioClase}-${start.toISOString()}`}
                            type="button"
                            className={`agendar-slot-card ${isSelected ? 'is-selected' : ''} ${cuposInfo.isFull ? 'is-full' : ''}`}
                            onClick={() => {
                              if (cuposInfo.isFull) return;
                              setSelectedDayDate(selectedDay.date);
                              setSelectedDateTime(isSelected ? null : start);
                            }}
                            disabled={cuposInfo.isFull}
                          >
                            <div className="agendar-slot-time">
                              <Clock3 size={18} aria-hidden="true" />
                              <strong>{formatHorarioTime(horario.horaIni)}</strong>
                              <span>{formatHorarioTime(horario.horaFin) !== '00:00' ? `hasta ${formatHorarioTime(horario.horaFin)}` : end.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="agendar-slot-occupancy">
                              <div className="agendar-slot-occupancy-top">
                                <span>{cuposInfo.isFull ? 'Completo' : availabilityLabel}</span>
                                {cuposInfo.total > 0 && cuposInfo.used !== null && (
                                  <small>{cuposInfo.percent}% ocupado</small>
                                )}
                              </div>
                              <span className="agendar-slot-bar" aria-hidden="true">
                                <span style={{ width: `${cuposInfo.percent}%` }} />
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="agendar-slots-panel">
                    <div className="agendar-empty-state agendar-empty-state-compact">
                      <CalendarDays size={22} aria-hidden="true" />
                      <p>Seleccioná un día disponible para ver sus horarios.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <aside className="agendar-resumen">
            <div>
              <span>Tu selección</span>
              <strong>{resumenSeleccion}</strong>
              {selectedCupos?.total > 0 && selectedCupos.used !== null && (
                <small>{selectedCupos.available} cupos libres</small>
              )}
            </div>
            <PrimaryButton
              onClick={manejarAgendarTurno}
              text={isAgendando ? 'Agendando...' : 'Agendar turno'}
            />
          </aside>
        </div>
      </div>
    </div>
  );
};

export default AgendarTurno;
