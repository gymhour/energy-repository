import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ScanLine, DollarSign, UserPlus, Calendar, Users, ArrowRight, LogIn, XCircle, CalendarCheck } from 'lucide-react';
import '../../../App.css';
import './InicioRecepcion.css';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import AttendanceTable from '../../../Components/Attendances/AttendanceTable';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton';
import apiService from '../../../services/apiService';
import { ATTENDANCE_STATUS } from '../../../types/attendanceTypes';

const ULTIMOS_INGRESOS_A_MOSTRAR = 8;

const ACCESOS_RAPIDOS = [
  { to: '/admin/ingreso', icon: ScanLine, label: 'Registrar ingreso' },
  { to: '/admin/cuotas', icon: DollarSign, label: 'Cuotas' },
  { to: '/admin/crear-usuario', icon: UserPlus, label: 'Crear usuario' },
  { to: '/admin/turnos', icon: Calendar, label: 'Turnos' },
  { to: '/admin/usuarios', icon: Users, label: 'Usuarios' },
];

const hoyISO = () => {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
};

const InicioRecepcion = () => {
  const [loading, setLoading] = useState(false);
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [ingresosHoy, setIngresosHoy] = useState(0);
  const [rechazadosHoy, setRechazadosHoy] = useState(0);
  const [turnosHoy, setTurnosHoy] = useState(0);
  const [ultimosIngresos, setUltimosIngresos] = useState([]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const hoy = hoyISO();
      try {
        const [usuario, asistencias, rechazadas, turnos] = await Promise.all([
          apiService.getUserById(localStorage.getItem('usuarioId')),
          apiService.getAttendances({ fromDate: hoy, toDate: hoy }, { take: ULTIMOS_INGRESOS_A_MOSTRAR }),
          apiService.getAttendances(
            { fromDate: hoy, toDate: hoy, status: ATTENDANCE_STATUS.REJECTED },
            { take: 1 }
          ),
          apiService.getTurnos({ fechaDesde: hoy, fechaHasta: hoy }),
        ]);

        setNombreUsuario([usuario?.nombre, usuario?.apellido].filter(Boolean).join(' '));
        setIngresosHoy(asistencias.pagination?.total || 0);
        setUltimosIngresos(asistencias.items || []);
        setRechazadosHoy(rechazadas.pagination?.total || 0);
        setTurnosHoy(Array.isArray(turnos) ? turnos.length : 0);
      } catch (error) {
        console.error('Error al cargar el panel de recepción:', error);
        toast.error('Error al cargar los datos. Intente nuevamente.');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const fechaLarga = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className='page-layout'>
      {loading && <LoaderFullScreen />}
      <SidebarMenu isAdmin={true} />

      <div className='content-layout'>
        <div className="recepcion-header">
          <h2>¡Hola, {nombreUsuario}!</h2>
          <p className="recepcion-fecha">{fechaLarga}</p>
        </div>

        <h3 className="recepcion-section-title">Accesos rápidos</h3>
        <div className="recepcion-shortcuts">
          {ACCESOS_RAPIDOS.map(({ to, icon: Icon, label }) => (
            <div key={to} className="recepcion-shortcut-item">
              <Link to={to} className="recepcion-shortcut-link">
                <Icon className="icon" /> {label}
              </Link>
            </div>
          ))}
        </div>

        <h3 className="recepcion-section-title">Resumen del día</h3>
        <div className='recepcion-kpi-grid'>
          <div className='recepcion-kpi-card'>
            <div className='recepcion-kpi-card-header'>
              <LogIn size={20} />
              <h3>Ingresos de hoy</h3>
            </div>
            <p className='value'>{ingresosHoy}</p>
          </div>

          {/* Un rechazo casi siempre es cuota impaga o plan vencido: es lo que recepción
              tiene que resolver en el momento, por eso linkea al detalle. */}
          <Link to="/admin/asistencias" className='recepcion-kpi-card recepcion-kpi-card-action'>
            <div className='recepcion-kpi-card-header'>
              <XCircle size={20} />
              <h3>Ingresos rechazados hoy</h3>
            </div>
            <p className='value'>{rechazadosHoy}</p>
          </Link>

          <Link to="/admin/turnos" className='recepcion-kpi-card recepcion-kpi-card-action'>
            <div className='recepcion-kpi-card-header'>
              <CalendarCheck size={20} />
              <h3>Turnos de hoy</h3>
            </div>
            <p className='value'>{turnosHoy}</p>
          </Link>
        </div>

        <div className="recepcion-ultimos-ingresos">
          <div className="recepcion-ultimos-ingresos-title">
            <h3>Últimos ingresos</h3>
            <SecondaryButton linkTo="/admin/asistencias" text="Ver todos" icon={ArrowRight} />
          </div>
          <AttendanceTable
            attendances={ultimosIngresos}
            emptyMessage="Todavía no se registraron ingresos hoy."
          />
        </div>
      </div>
    </div>
  );
};

export default InicioRecepcion;
