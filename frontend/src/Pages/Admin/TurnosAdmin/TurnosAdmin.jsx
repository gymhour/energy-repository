import React, { useState, useEffect, useMemo } from 'react'
import { CalendarPlus, RotateCcw, Trash2, X } from 'lucide-react'
import ReprogramarTurnoModal from '../../../Components/utils/ReprogramarTurnoModal/ReprogramarTurnoModal'
import ConfirmationPopup from '../../../Components/utils/ConfirmationPopUp/ConfirmationPopUp'
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu'
import { Calendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import 'moment/locale/es'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './TurnosAdmin.css'
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen'
import { toast } from 'react-toastify'
import CustomDropdown from '../../../Components/utils/CustomDropdown/CustomDropdown'
import apiService from '../../../services/apiService'

moment.locale('es')

const localizer = momentLocalizer(moment)

const CANCELLED_STATUS = 'CANCELADO'

const TURNO_STATUS_LABELS = {
  ACTIVO: 'Activo',
  ASISTIDO: 'Asistió',
  AUSENTE: 'Ausente',
  CANCELADO: 'Cancelado'
}

const normalizeTurnoStatus = status => String(status || '').toUpperCase()
const isCancelledTurno = turno => normalizeTurnoStatus(turno.estado) === CANCELLED_STATUS
const getTurnoStatusLabel = status => TURNO_STATUS_LABELS[normalizeTurnoStatus(status)] || status || 'Sin estado'

const getTurnoUser = turno => {
  const nombre = turno.User?.nombre || ''
  const apellido = turno.User?.apellido || ''

  return {
    id: turno.id_turno || turno.ID_Turno || turno.id || `${nombre}-${apellido}-${turno.fecha}`,
    turnoId: turno.id_turno || turno.ID_Turno || null,
    userId: turno.User?.ID_Usuario || null,
    name: `${nombre} ${apellido}`.trim() || 'Usuario sin nombre',
    status: normalizeTurnoStatus(turno.estado)
  }
}

const getTurnoCuposKey = turno => `${turno.ID_HorarioClase}__${turno.fecha}`

const getEventAvailability = (event, availability) => {
  const total = Number(availability?.cupos ?? event.cupos ?? 0)
  const committedSource = availability?.cuposUsados
  const committed = Number.isFinite(Number(committedSource))
    ? Number(committedSource)
    : event.activeUsers.length

  return {
    ...event,
    cupos: total,
    cuposUsados: committed,
    cuposDisponibles: Math.max(total - committed, 0),
    reservasFijasPendientes: Number(availability?.reservasFijasPendientes ?? 0)
  }
}

// Contenido de cada recuadro de turno: nombre de la clase + disponibilidad real.
const EventContent = ({ event }) => (
  <div className="ta-event">
    <span className="ta-event-title">{event.title}</span>
    <span className="ta-event-count">{event.cuposDisponibles} libres de {event.cupos}</span>
  </div>
)

const CALENDAR_COMPONENTS = { event: EventContent }

const TurnosAdmin = ({ fromAdmin, fromEntrenador }) => {
  const [rawTurnos, setRawTurnos] = useState([])
  const [cuposByTurno, setCuposByTurno] = useState({})
  const [loading, setLoading] = useState(true)
  const [calendarDate, setCalendarDate] = useState(new Date())

  // filtros
  const [selectedClass, setSelectedClass] = useState('')

  // modal
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const closeModal = () => { setIsModalOpen(false); setSelectedEvent(null) }

  // Eliminar y reprogramar (solo admin): { user: {id,nombre}, turno: {id,label} }
  const [reprogramarData, setReprogramarData] = useState(null)
  const [showCreateTurnoModal, setShowCreateTurnoModal] = useState(false)
  const [cancelTurnoData, setCancelTurnoData] = useState(null)
  const [cancelTurnoLoading, setCancelTurnoLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // calendario
  const MOBILE_BREAKPOINT = 850;
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  );

  const selectedMonth = moment(calendarDate).month()
  const selectedYear = moment(calendarDate).year()
  const weekStart = useMemo(
    () => moment(calendarDate).startOf('isoWeek').format('YYYY-MM-DD'),
    [calendarDate]
  )
  const weekEnd = useMemo(
    () => moment(calendarDate).startOf('isoWeek').add(6, 'days').format('YYYY-MM-DD'),
    [calendarDate]
  )

  useEffect(() => {
    let isCurrentRequest = true

    setLoading(true)
    apiService.getTurnos({ fechaDesde: weekStart, fechaHasta: weekEnd })
      .then(async data => {
        const turnosUnicos = Array.from(new Map(
          data.map(turno => [getTurnoCuposKey(turno), turno])
        ).values())
        const disponibilidades = await Promise.all(turnosUnicos.map(async turno => {
          try {
            const dataCupos = await apiService.getHorarioCupos(turno.ID_HorarioClase, turno.fecha)
            return [getTurnoCuposKey(turno), dataCupos]
          } catch {
            return [getTurnoCuposKey(turno), null]
          }
        }))

        if (isCurrentRequest) {
          setRawTurnos(data)
          setCuposByTurno(Object.fromEntries(disponibilidades))
        }
      })
      .catch(err => {
        console.log(err)
        if (isCurrentRequest) toast.error('Error al cargar los turnos de la semana.')
      })
      .finally(() => {
        if (isCurrentRequest) setLoading(false)
      })

    return () => { isCurrentRequest = false }
  }, [weekStart, weekEnd, refreshKey])

  // opciones de filtro
  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => ({
      value: m,
      label: moment({ year: selectedYear, month: m, day: 1 }).format('MMMM YYYY')
    }))
  }, [selectedYear])

  const classOptions = useMemo(() => {
    return Array.from(
      new Set(rawTurnos.map(t => t.HorarioClase.Clase.nombre))
    ).sort()
  }, [rawTurnos])

  const parseLocalISO = isoString => {
    const d = new Date(isoString)
    return new Date(d.getTime() + d.getTimezoneOffset() * 60000)
  }

  const parseTurnoDate = isoString => {
    const d = new Date(isoString)
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  }

  const events = useMemo(() => {
    // 1) filtramos
    const filtrados = rawTurnos.filter(t =>
      selectedClass === '' || t.HorarioClase.Clase.nombre === selectedClass
    )

    // 2) reducimos a un objeto de grupos
    const grupos = filtrados.reduce((acc, t) => {
      // fecha base (día correcto)
      const fecha = parseTurnoDate(t.fecha)

      // parseo de horaIni/horaFin en local
      const horaIni = parseLocalISO(t.HorarioClase.horaIni)
      const horaFin = parseLocalISO(t.HorarioClase.horaFin)

      // inyecto la horaIni en la fecha
      fecha.setHours(horaIni.getHours(), horaIni.getMinutes(), horaIni.getSeconds())
      const start = fecha

      // clono y le pongo horaFin
      const end = new Date(fecha)
      end.setHours(horaFin.getHours(), horaFin.getMinutes(), horaFin.getSeconds())

      const key = `${start.toISOString()}__${t.HorarioClase.Clase.nombre}`

      if (!acc[key]) {
        acc[key] = {
          id: key,
          title: t.HorarioClase.Clase.nombre,
          start,
          end,
          cupos: t.HorarioClase.cupos,
          horarioId: t.ID_HorarioClase,
          fecha: t.fecha,
          cuposKey: getTurnoCuposKey(t),
          activeUsers: [],
          cancelledUsers: []
        }
      }

      const user = getTurnoUser(t)
      if (isCancelledTurno(t)) {
        acc[key].cancelledUsers.push(user)
      } else {
        acc[key].activeUsers.push(user)
      }

      return acc
    }, {})

    return Object.values(grupos).map(event => (
      getEventAvailability(event, cuposByTurno[event.cuposKey])
    ))
  }, [rawTurnos, selectedClass, cuposByTurno])

  const handleSelectEvent = ev => {
    setSelectedEvent(ev)
    setIsModalOpen(true)
  }

  const openReprogramar = (user) => {
    if (!selectedEvent || !user.turnoId || !user.userId) return
    setReprogramarData({
      user: { id: user.userId, nombre: user.name },
      turno: {
        id: user.turnoId,
        label: `${moment(selectedEvent.start).format('dddd DD/MM HH:mm')} · ${selectedEvent.title} (${getTurnoStatusLabel(user.status)})`
      }
    })
  }

  const openCancelTurno = (user) => {
    if (!selectedEvent || !user.turnoId) return
    setCancelTurnoData({
      user,
      label: `${moment(selectedEvent.start).format('dddd DD/MM HH:mm')} · ${selectedEvent.title}`,
    })
  }

  const handleCancelTurno = async () => {
    const turnoId = cancelTurnoData?.user?.turnoId
    if (!turnoId || cancelTurnoLoading) return

    setCancelTurnoLoading(true)
    try {
      await apiService.deleteTurno(turnoId)
      let disponibilidadActualizada = null
      try {
        disponibilidadActualizada = await apiService.getHorarioCupos(
          selectedEvent.horarioId,
          selectedEvent.fecha
        )
      } catch {
        // El turno ya fue cancelado; el refresco semanal recuperará la disponibilidad.
      }

      setRawTurnos(prev => prev.map(turno =>
        (turno.id_turno || turno.ID_Turno) === turnoId
          ? { ...turno, estado: CANCELLED_STATUS }
          : turno
      ))
      if (disponibilidadActualizada) {
        setCuposByTurno(prev => ({
          ...prev,
          [selectedEvent.cuposKey]: disponibilidadActualizada
        }))
      }
      setSelectedEvent(prev => {
        if (!prev) return prev
        const nextEvent = {
          ...prev,
          activeUsers: prev.activeUsers.filter(u => u.turnoId !== turnoId),
          cancelledUsers: [
            ...prev.cancelledUsers,
            { ...cancelTurnoData.user, status: CANCELLED_STATUS }
          ],
        }
        return getEventAvailability(nextEvent, disponibilidadActualizada)
      })
      toast.success('Turno cancelado correctamente.')
      setCancelTurnoData(null)
    } catch (error) {
      toast.error(error?.message || 'No se pudo cancelar el turno.')
    } finally {
      setCancelTurnoLoading(false)
    }
  }

  // Post-borrado físico: sacar el turno del popup abierto y refrescar la semana
  const handleTurnoEliminado = () => {
    const turnoId = reprogramarData?.turno?.id
    setSelectedEvent(prev => prev ? {
      ...prev,
      activeUsers: prev.activeUsers.filter(u => u.turnoId !== turnoId),
      cancelledUsers: prev.cancelledUsers.filter(u => u.turnoId !== turnoId),
    } : prev)
    setRefreshKey(k => k + 1)
  }

  const handleMonthChange = e => {
    const nextMonth = Number(e.target.value)
    const today = moment()
    const nextDate = moment(calendarDate)
      .date(1)
      .month(nextMonth)
      .date(nextMonth === today.month() && selectedYear === today.year() ? today.date() : 1)
      .toDate()

    setCalendarDate(nextDate)
  }

  const handleNavigate = nextDate => {
    setCalendarDate(nextDate)
  }

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const messages = React.useMemo(() => ({
    date: 'Fecha',
    time: 'Hora',
    event: 'Evento',
    allDay: 'Todo el día',
    week: 'Semana',
    day: 'Día',
    month: 'Mes',
    previous: isNarrow ? 'Día anterior' : 'Semana anterior',
    next: isNarrow ? 'Día siguiente' : 'Semana siguiente',
    yesterday: 'Ayer',
    tomorrow: 'Mañana',
    today: 'Hoy',
    agenda: 'Agenda',
    noEventsInRange: 'No hay eventos en este rango.',
    showMore: total => `+ Ver más (${total})`,
  }), [isNarrow]);


  return (
    <div className='page-layout turnos-admin'>
      <SidebarMenu isAdmin={fromAdmin} isEntrenador={fromEntrenador} />
      {loading && <LoaderFullScreen />}
      <div className='content-layout'>
        <div className="turnos-admin-header">
          <div>
            <h2>Turnos</h2>
          </div>
          {fromAdmin && (
            <button
              type="button"
              className="ta-create-turno-button"
              onClick={() => setShowCreateTurnoModal(true)}
            >
              <CalendarPlus size={17} />
              Crear turno
            </button>
          )}
        </div>

        <div className='turnos-filters'>
          <div className="turnos-filters-controls">
            <div className='turnos-filters-input-ctn'>
              <label>Mes</label>
              <CustomDropdown
                options={monthOptions}
                value={String(selectedMonth ?? '')}
                onChange={handleMonthChange}
                name="month"
                id="month"
                placeholderOption={null}
              />
            </div>

            <div className="turnos-filters-input-ctn">
              <label>Clase</label>
              <CustomDropdown
                options={classOptions}
                value={selectedClass ?? ''}
                onChange={e => setSelectedClass(e.target.value)}
                name="class"
                id="class"
                placeholderOption="Todas"
                placeholderDisabled={false}
              />
            </div>
          </div>
        </div>


        <div className="calendar-wrapper">
          <Calendar
            key={isNarrow ? 'day' : 'week'}
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            defaultView={isNarrow ? 'day' : 'week'}
            views={isNarrow ? ['day'] : ['week']}
            date={calendarDate}
            onNavigate={handleNavigate}
            step={60}
            timeslots={1}
            onSelectEvent={handleSelectEvent}
            scrollToTime={new Date(1970, 1, 1, 6)}
            messages={messages}
            components={CALENDAR_COMPONENTS}
          />
        </div>

      </div>

      {/* Modal de reservas */}
      {isModalOpen && selectedEvent && (
        <div className="ta-modal" onClick={closeModal}>
          <div className="ta-modal-content" onClick={e => e.stopPropagation()}>
            <button className="ta-modal-close" onClick={closeModal} aria-label="Cerrar modal"><X size={18} /></button>
            <div className="ta-modal-header">
              <span className="ta-modal-kicker">Reservas</span>
              <h4>{selectedEvent.title}</h4>
              <p>
                {moment(selectedEvent.start).format('dddd D [de] MMMM, HH:mm')} - {moment(selectedEvent.end).format('HH:mm')}
              </p>
            </div>
            <div className="ta-modal-count">
              <div>
                <strong className="ta-modal-count-ratio">{selectedEvent.cuposDisponibles}</strong> libres de {selectedEvent.cupos}
              </div>
              <span>{selectedEvent.cuposUsados}/{selectedEvent.cupos} cupos comprometidos</span>
            </div>
            <div className="ta-modal-reservation-section">
              <div className="ta-modal-section-title">
                <span>Turnos activos</span>
                <strong>{selectedEvent.activeUsers.length}</strong>
              </div>
              {selectedEvent.activeUsers.length > 0 ? (
                <ul className="ta-modal-users">
                  {selectedEvent.activeUsers.map((user, i) => (
                    <li key={user.id || i}>
                      <span className="ta-modal-avatar">{user.name.trim().charAt(0).toUpperCase()}</span>
                      <span className="ta-modal-user-name">{user.name}</span>
                      <span className={`ta-modal-status ta-modal-status-${user.status.toLowerCase()}`}>
                        {getTurnoStatusLabel(user.status)}
                      </span>
                      {fromAdmin && user.status === 'AUSENTE' && user.turnoId && user.userId && (
                        <button
                          type="button"
                          className="ta-modal-reprogram"
                          title="Eliminar definitivamente y crear un turno nuevo"
                          aria-label={`Eliminar y reprogramar turno de ${user.name}`}
                          onClick={() => openReprogramar(user)}
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                      {fromAdmin && user.turnoId && user.status !== CANCELLED_STATUS && (
                        <button
                          type="button"
                          className="ta-modal-cancel-turno"
                          title="Cancelar turno"
                          aria-label={`Cancelar turno de ${user.name}`}
                          onClick={() => openCancelTurno(user)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ta-modal-empty">No hay reservas activas.</p>
              )}
            </div>

            {selectedEvent.reservasFijasPendientes > 0 && (
              <div className="ta-modal-reservation-section">
                <div className="ta-modal-section-title">
                  <span>Turnos fijos pendientes</span>
                  <strong>{selectedEvent.reservasFijasPendientes}</strong>
                </div>
              </div>
            )}

            <div className="ta-modal-reservation-section">
              <div className="ta-modal-section-title">
                <span>Cancelados</span>
                <strong>{selectedEvent.cancelledUsers.length}</strong>
              </div>
              {selectedEvent.cancelledUsers.length > 0 ? (
                <ul className="ta-modal-users ta-modal-users-cancelled">
                  {selectedEvent.cancelledUsers.map((user, i) => (
                    <li key={user.id || i}>
                      <span className="ta-modal-avatar">{user.name.trim().charAt(0).toUpperCase()}</span>
                      <span className="ta-modal-user-name">{user.name}</span>
                      <span className="ta-modal-status ta-modal-status-cancelado">
                        {getTurnoStatusLabel(user.status)}
                      </span>
                      {fromAdmin && user.turnoId && user.userId && (
                        <button
                          type="button"
                          className="ta-modal-reprogram"
                          title="Eliminar definitivamente y crear un turno nuevo"
                          aria-label={`Eliminar y reprogramar turno de ${user.name}`}
                          onClick={() => openReprogramar(user)}
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ta-modal-empty">No hay turnos cancelados.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Eliminar y reprogramar turno (solo admin) ─── */}
      <ReprogramarTurnoModal
        isOpen={!!reprogramarData}
        user={reprogramarData?.user}
        turno={reprogramarData?.turno}
        onClose={() => { setReprogramarData(null); setRefreshKey(k => k + 1) }}
        onDeleted={handleTurnoEliminado}
      />

      <ReprogramarTurnoModal
        isOpen={showCreateTurnoModal}
        createOnly
        allowUserSelection
        onClose={() => {
          setShowCreateTurnoModal(false)
          setRefreshKey(k => k + 1)
        }}
      />

      <ConfirmationPopup
        isOpen={!!cancelTurnoData}
        onClose={() => {
          if (!cancelTurnoLoading) setCancelTurnoData(null)
        }}
        onConfirm={handleCancelTurno}
        message={`¿Confirmás cancelar el turno de ${cancelTurnoData?.user?.name || 'este usuario'}?`}
      >
        <p style={{ margin: '8px 0 0', color: 'var(--text-color-distinct)', fontSize: '14px' }}>
          {cancelTurnoData?.label}
        </p>
      </ConfirmationPopup>
    </div>
  )
}

export default TurnosAdmin
