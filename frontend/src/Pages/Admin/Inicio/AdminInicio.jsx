import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../../App.css';
import './AdminInicio.css';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import apiService from '../../../services/apiService';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import { generateFinancialReportPdf } from '../../../utils/financialReportPdf';
import logoBlack from '../../../assets/gymhour/logo_gymhour_black.png';
import { Users, DollarSign, Clock, TrendingUp, TrendingDown, Wallet, UserPlus, UserMinus, Percent } from 'lucide-react';
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { toast } from 'react-toastify';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton';
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton';
import { ChevronDown, ChevronUp, Download, SlidersHorizontal } from 'lucide-react';

const POSITIVE = '#22c55e';
const NEGATIVE = '#e5484d';

const AdminInicio = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [kpi, setKpi] = useState({
    totalActiveUsers: 0,
    totalInactiveUsers: 0,
    quotasPaidThisMonth: 0,
    quotasPendingThisMonth: 0,
    totalAmountPaidThisMonth: 0,
    totalAmountPendingThisMonth: 0,
    quotasOverdue: 0,
    totalAmountOverdue: 0,
    gastosMes: 0,
    gananciaNetaMes: 0,
    tasaCobranzaMes: 0,
    altasMes: 0,
    reactivacionesMes: 0,
    bajasMes: 0,
    crecimientoNetoMes: 0,
  });

  // Series para gráficos
  const [finance, setFinance] = useState([]);       // [{ mes, ingresos, gastos, ganancia }]
  const [membership, setMembership] = useState([]); // [{ mes, altasNuevas, reactivaciones, altas, bajas, neto }]
  const [bajasMotivo, setBajasMotivo] = useState([]); // [{ mes, motivo, cantidad }]
  const [altasMotivo, setAltasMotivo] = useState([]); // [{ mes, motivo, cantidad }] (altas + reactivaciones)

  const [nombreUsuario, setNombreUsuario] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Refs para capturar cada gráfico en el PDF
  const financeRef = useRef(null);
  const membershipRef = useRef(null);
  const motivoRef = useRef(null);
  const altasMotivoRef = useRef(null);

  // Filtros de rango (mes/año)
  const [inputStartDate, setInputStartDate] = useState(null);
  const [inputEndDate, setInputEndDate] = useState(null);
  const [filterStartDate, setFilterStartDate] = useState(null);
  const [filterEndDate, setFilterEndDate] = useState(null);

  const getKPIs = async () => {
    setLoading(true);
    try {
      const response = await apiService.getKPIs();
      setKpi(prev => ({ ...prev, ...(response?.kpi || {}) }));
      setFinance(response?.financeHistory || []);
      setMembership(response?.membershipHistory || []);
      setBajasMotivo(response?.bajasPorMotivo || []);
      setAltasMotivo(response?.altasPorMotivo || []);
    } catch (error) {
      console.error('Error al obtener los KPIs:', error);
      toast.error('Error al cargar KPIs');
    } finally {
      setLoading(false);
    }
  };

  const getUser = async () => {
    setLoading(true);
    try {
      const response = await apiService.getUserById(localStorage.getItem("usuarioId"));
      setNombreUsuario(response.tipo === "admin" ? "Administrador" : (response.nombre || ""));
    } catch (error) {
      console.error('Error al obtener el usuario:', error);
      toast.error("Error al obtener el usuario");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getUser();
    getKPIs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currencyFormatter = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`;

  const parseMesToDate = (mesString) => {
    const [year, month] = mesString.split('-').map(Number);
    return new Date(year, month - 1, 1);
  };

  const mesInRange = (mes) => {
    if (!mes) return false;
    const d = parseMesToDate(mes);
    if (filterStartDate && d < filterStartDate) return false;
    if (filterEndDate && d > filterEndDate) return false;
    return true;
  };

  const financeData = finance.filter(f => mesInRange(f.mes));
  const membershipData = membership.filter(m => mesInRange(m.mes));

  // Bajas por motivo agregadas sobre el rango activo
  const motivoTotals = {};
  bajasMotivo.forEach(b => {
    if (mesInRange(b.mes)) motivoTotals[b.motivo] = (motivoTotals[b.motivo] || 0) + b.cantidad;
  });
  const motivoData = Object.entries(motivoTotals)
    .map(([motivo, cantidad]) => ({ motivo, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  // Altas (nuevas + reactivaciones) por motivo, agregadas sobre el rango activo
  const altaMotivoTotals = {};
  altasMotivo.forEach(a => {
    if (mesInRange(a.mes)) altaMotivoTotals[a.motivo] = (altaMotivoTotals[a.motivo] || 0) + a.cantidad;
  });
  const altaMotivoData = Object.entries(altaMotivoTotals)
    .map(([motivo, cantidad]) => ({ motivo, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  const applyFilters = () => {
    setFilterStartDate(inputStartDate ? new Date(inputStartDate.getFullYear(), inputStartDate.getMonth(), 1) : null);
    if (inputEndDate) {
      const lastDay = new Date(inputEndDate.getFullYear(), inputEndDate.getMonth() + 1, 0).getTime();
      setFilterEndDate(new Date(lastDay));
    } else {
      setFilterEndDate(null);
    }
  };

  const clearFilters = () => {
    setInputStartDate(null);
    setInputEndDate(null);
    setFilterStartDate(null);
    setFilterEndDate(null);
  };

  const currentMonthName = new Date()
    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    .replace(' de', '');
  const currentMonthKey = (() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  })();

  const navigateToUsuarios = (params) => {
    navigate(`/admin/usuarios?${new URLSearchParams(params).toString()}`);
  };

  const navigateToCuotas = (params) => {
    navigate(`/admin/cuotas?${new URLSearchParams(params).toString()}`);
  };

  const fmtMes = (d) => d ? `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : null;
  const periodoLabel = (filterStartDate || filterEndDate)
    ? `${fmtMes(filterStartDate) || 'inicio'} – ${fmtMes(filterEndDate) || 'hoy'}`
    : 'Histórico completo';

  const handleDownloadPdf = async () => {
    setExporting(true);
    try {
      const charts = [];
      if (financeData.length > 0) charts.push({ title: 'Ingresos vs Gastos · Ganancia neta', node: financeRef.current });
      if (membershipData.length > 0) charts.push({ title: 'Crecimiento de socios', node: membershipRef.current });
      if (altaMotivoData.length > 0) charts.push({ title: 'Altas por motivo', node: altasMotivoRef.current });
      if (motivoData.length > 0) charts.push({ title: 'Bajas por motivo', node: motivoRef.current });

      await generateFinancialReportPdf({
        kpi,
        periodoLabel,
        aclaracionKpis: `KPIs del mes corriente (${currentMonthName}) · Deuda vencida: acumulada · Clientes activos: total actual · Gráficos: ${periodoLabel}`,
        charts,
        logoSrc: logoBlack,
      });
    } catch (err) {
      console.error('Error al generar el PDF:', err);
      toast.error('No se pudo generar el PDF.');
    } finally {
      setExporting(false);
    }
  };

  // Estilos compartidos de tooltip recharts (tematizados)
  const tooltipStyle = {
    backgroundColor: "var(--background-color-distinct)",
    border: "1px solid var(--border-color)",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  };
  const axisTick = { fill: "var(--text-color)", fontSize: 12 };

  return (
    <div className='page-layout'>
      {loading && <LoaderFullScreen />}
      <SidebarMenu isAdmin={true} />

      <div className='content-layout'>
        <div className="admin-inicio-topbar">
          <div className="admin-inicio-header">
            <h2>¡Hola, {nombreUsuario}!</h2>
          </div>
          <button
            type="button"
            className="download-pdf-btn"
            onClick={handleDownloadPdf}
            disabled={exporting}
          >
            <Download size={18} />
            {exporting ? 'Generando PDF…' : 'Descargar PDF'}
          </button>
        </div>

        {/* ===================== FINANZAS ===================== */}
        <h3 className="dashboard-section-title">Finanzas <span className="month-label">({currentMonthName})</span></h3>
        <div className='admin-kpi-grid'>
          <button
            type="button"
            className='admin-kpi-card admin-kpi-card-action'
            onClick={() => navigateToCuotas({ estado: 'pagada', mes: currentMonthKey })}
            aria-label="Ver cuotas pagadas del mes"
          >
            <div className='admin-kpi-card-header'>
              <DollarSign size={20} className="icon-soft-grey" />
              <h3>Ingresos</h3>
            </div>
            <p className='value'>
              {currencyFormatter(kpi.totalAmountPaidThisMonth)}
              <span className="admin-kpi-count">({kpi.quotasPaidThisMonth})</span>
            </p>
          </button>

          <div className='admin-kpi-card'>
            <div className='admin-kpi-card-header'>
              <Wallet size={20} className="icon-soft-grey" />
              <h3>Gastos</h3>
            </div>
            <p className='value'>{currencyFormatter(kpi.gastosMes)}</p>
          </div>

          <div className='admin-kpi-card'>
            <div className='admin-kpi-card-header'>
              {kpi.gananciaNetaMes >= 0
                ? <TrendingUp size={20} className="icon-soft-grey" />
                : <TrendingDown size={20} className="icon-soft-grey" />}
              <h3>Ganancia neta</h3>
            </div>
            <p className='value' style={{ color: kpi.gananciaNetaMes >= 0 ? POSITIVE : NEGATIVE }}>
              {currencyFormatter(kpi.gananciaNetaMes)}
            </p>
          </div>

          <button
            type="button"
            className='admin-kpi-card admin-kpi-card-action'
            onClick={() => navigateToCuotas({ estado: 'pendiente', mes: currentMonthKey })}
            aria-label="Ver cuotas pendientes del mes"
          >
            <div className="admin-kpi-card-header">
              <Clock size={20} className="icon-soft-grey" />
              <h3>Por cobrar</h3>
            </div>
            <p className='value'>
              {currencyFormatter(kpi.totalAmountPendingThisMonth)}
              <span className="admin-kpi-count">({kpi.quotasPendingThisMonth})</span>
            </p>
          </button>

          <div className='admin-kpi-card'>
            <div className="admin-kpi-card-header">
              <Percent size={20} className="icon-soft-grey" />
              <h3>Tasa de cobranza</h3>
            </div>
            <p className='value'>{kpi.tasaCobranzaMes}%</p>
          </div>

          <button
            type="button"
            className='admin-kpi-card admin-kpi-card-action'
            onClick={() => navigateToCuotas({ estado: 'vencida' })}
            aria-label="Ver cuotas vencidas"
          >
            <div className="admin-kpi-card-header">
              <Clock size={20} className="icon-soft-grey" />
              <h3>Deuda vencida <span className="month-label">(acumulada)</span></h3>
            </div>
            <p className='value'>
              {currencyFormatter(kpi.totalAmountOverdue)}
              <span className="admin-kpi-count">({kpi.quotasOverdue})</span>
            </p>
          </button>
        </div>

        {/* ===================== SOCIOS ===================== */}
        <h3 className="dashboard-section-title">Socios <span className="month-label">({currentMonthName})</span></h3>
        <div className='admin-kpi-grid'>
          <button
            type="button"
            className='admin-kpi-card admin-kpi-card-action'
            onClick={() => navigateToUsuarios({ tipo: 'Cliente', estado: 'Activo' })}
            aria-label="Ver clientes activos"
          >
            <div className='admin-kpi-card-header'>
              <Users size={20} className="icon-soft-grey" />
              <h3>Clientes activos</h3>
            </div>
            <p className='value'>{kpi.totalActiveUsers}</p>
          </button>

          <button
            type="button"
            className='admin-kpi-card admin-kpi-card-action'
            onClick={() => navigateToUsuarios({ tipo: 'Cliente', movimiento: 'ALTA', mes: currentMonthKey })}
            aria-label="Ver altas del mes"
          >
            <div className='admin-kpi-card-header'>
              <UserPlus size={20} className="icon-soft-grey" />
              <h3>Altas</h3>
            </div>
            <p className='value'>
              {kpi.altasMes}
              <span className="admin-kpi-count">({kpi.reactivacionesMes} react.)</span>
            </p>
          </button>

          <button
            type="button"
            className='admin-kpi-card admin-kpi-card-action'
            onClick={() => navigateToUsuarios({ tipo: 'Cliente', movimiento: 'BAJA', mes: currentMonthKey })}
            aria-label="Ver bajas del mes"
          >
            <div className='admin-kpi-card-header'>
              <UserMinus size={20} className="icon-soft-grey" />
              <h3>Bajas</h3>
            </div>
            <p className='value'>{kpi.bajasMes}</p>
          </button>

          <button
            type="button"
            className='admin-kpi-card admin-kpi-card-action'
            onClick={() => navigateToUsuarios({ tipo: 'Cliente', estado: 'Inactivo' })}
            aria-label="Ver clientes inactivos"
          >
            <div className='admin-kpi-card-header'>
              <Users size={20} className="icon-soft-grey" />
              <h3>Clientes inactivos</h3>
            </div>
            <p className='value'>{kpi.totalInactiveUsers}</p>
          </button>

          <div className='admin-kpi-card'>
            <div className='admin-kpi-card-header'>
              {kpi.crecimientoNetoMes >= 0
                ? <TrendingUp size={20} className="icon-soft-grey" />
                : <TrendingDown size={20} className="icon-soft-grey" />}
              <h3>Crecimiento neto</h3>
            </div>
            <p className='value' style={{ color: kpi.crecimientoNetoMes >= 0 ? POSITIVE : NEGATIVE }}>
              {kpi.crecimientoNetoMes > 0 ? '+' : ''}{kpi.crecimientoNetoMes}
            </p>
          </div>
        </div>

        {/* ===================== TENDENCIAS ===================== */}
        <div className='chart-section'>
          <div className="chart-section-header">
            <h3>Tendencias</h3>
            <button className='toggle-filters-button' onClick={() => setShowFilters(prev => !prev)}>
              <SlidersHorizontal /> Filtros {showFilters ? <ChevronUp /> : <ChevronDown />}
            </button>
          </div>

          {showFilters && (
            <div className='filters-container'>
              <div className='admin-inicio-filtros-inputs-ctn'>
                <label>Desde (Mes/Año):</label>
                <ReactDatePicker
                  selected={inputStartDate}
                  onChange={date => setInputStartDate(date)}
                  dateFormat="MM/yyyy"
                  showMonthYearPicker
                  placeholderText="MM/AAAA"
                  className='custom-datepicker-mes'
                />
              </div>
              <div className='admin-inicio-filtros-inputs-ctn'>
                <label>Hasta (Mes/Año):</label>
                <ReactDatePicker
                  selected={inputEndDate}
                  onChange={date => setInputEndDate(date)}
                  dateFormat="MM/yyyy"
                  showMonthYearPicker
                  placeholderText="MM/AAAA"
                  className='custom-datepicker-mes'
                />
              </div>
              <div className='admin-inicio-filtros-btns-ctn'>
                <PrimaryButton onClick={applyFilters} text="Aplicar filtros" />
                <SecondaryButton onClick={clearFilters} text="Limpiar filtros" />
              </div>
            </div>
          )}

          {/* --- Ingresos vs Gastos + Ganancia --- */}
          <h4 className="chart-subtitle">Ingresos vs Gastos · Ganancia neta</h4>
          {financeData.length > 0 ? (
            <div ref={financeRef} className="chart-capture">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={financeData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border-color)" strokeDasharray="3 3" />
                <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={axisTick} />
                <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={currencyFormatter} width={80} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--text-color)", fontWeight: "bold" }}
                  formatter={(value, name) => [currencyFormatter(value), name]} cursor={{ fill: "var(--background-hover-color)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ingresos" name="Ingresos" fill={POSITIVE} radius={[6, 6, 0, 0]} barSize={28} />
                <Bar dataKey="gastos" name="Gastos" fill={NEGATIVE} radius={[6, 6, 0, 0]} barSize={28} />
                <Line type="monotone" dataKey="ganancia" name="Ganancia neta" stroke="var(--primary-color)" strokeWidth={3} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
            </div>
          ) : (
            <p>No hay datos financieros para el período.</p>
          )}

          {/* --- Crecimiento de socios --- */}
          <h4 className="chart-subtitle">Crecimiento de socios (altas / bajas)</h4>
          {membershipData.length > 0 ? (
            <div ref={membershipRef} className="chart-capture">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={membershipData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border-color)" strokeDasharray="3 3" />
                <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={axisTick} />
                <YAxis axisLine={false} tickLine={false} tick={axisTick} allowDecimals={false} width={40} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--text-color)", fontWeight: "bold" }}
                  cursor={{ fill: "var(--background-hover-color)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="altasNuevas" name="Altas nuevas" stackId="altas" fill={POSITIVE} radius={[0, 0, 0, 0]} barSize={28} />
                <Bar dataKey="reactivaciones" name="Reactivaciones" stackId="altas" fill="#86efac" radius={[6, 6, 0, 0]} barSize={28} />
                <Bar dataKey="bajas" name="Bajas" fill={NEGATIVE} radius={[6, 6, 0, 0]} barSize={28} />
                <Line type="monotone" dataKey="neto" name="Crecimiento neto" stroke="var(--primary-color)" strokeWidth={3} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
            </div>
          ) : (
            <p>No hay datos de socios para el período.</p>
          )}

          {/* --- Altas por motivo --- */}
          <h4 className="chart-subtitle">Altas por motivo (nuevas + reactivaciones)</h4>
          {altaMotivoData.length > 0 ? (
            <div ref={altasMotivoRef} className="chart-capture">
            <ResponsiveContainer width="100%" height={Math.max(220, altaMotivoData.length * 44)}>
              <BarChart data={altaMotivoData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid horizontal={false} stroke="var(--border-color)" strokeDasharray="3 3" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={axisTick} allowDecimals={false} />
                <YAxis type="category" dataKey="motivo" axisLine={false} tickLine={false} tick={axisTick} width={190} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--text-color)", fontWeight: "bold" }}
                  cursor={{ fill: "var(--background-hover-color)" }} formatter={(value) => [value, 'Altas']} />
                <Bar dataKey="cantidad" name="Altas" fill={POSITIVE} radius={[0, 6, 6, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          ) : (
            <p>No hay altas registradas para el período.</p>
          )}

          {/* --- Bajas por motivo --- */}
          <h4 className="chart-subtitle">Bajas por motivo</h4>
          {motivoData.length > 0 ? (
            <div ref={motivoRef} className="chart-capture">
            <ResponsiveContainer width="100%" height={Math.max(220, motivoData.length * 44)}>
              <BarChart data={motivoData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid horizontal={false} stroke="var(--border-color)" strokeDasharray="3 3" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={axisTick} allowDecimals={false} />
                <YAxis type="category" dataKey="motivo" axisLine={false} tickLine={false} tick={axisTick} width={190} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--text-color)", fontWeight: "bold" }}
                  cursor={{ fill: "var(--background-hover-color)" }} formatter={(value) => [value, 'Bajas']} />
                <Bar dataKey="cantidad" name="Bajas" fill={NEGATIVE} radius={[0, 6, 6, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          ) : (
            <p>No hay bajas registradas para el período.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminInicio;
