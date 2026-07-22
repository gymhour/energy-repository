import React, { useEffect, useState } from 'react';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import './Cuotas.css';
// import axios from 'axios'; // ← no se usa
// import { ReactComponent as GaliciaIcon } from '../../../assets/icons/galicia_logo.svg';
import { Copy } from 'lucide-react';
import { toast } from 'react-toastify';
import apiService from '../../../services/apiService';
import CLIENT_SETUP from '../../../setup';

const Cuotas = () => {
  const [cuotas, setCuotas] = useState([]);   // siempre array
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { accountHolder, alias, cbu, cuil, whatsapp } = CLIENT_SETUP.payment;
  const whatsappHref = `https://wa.me/${whatsapp.phoneNumber}?text=${encodeURIComponent(whatsapp.message)}`;

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado al portapapeles');
    } catch (err) {
      console.error('Error copiando al portapapeles', err);
      toast.error('No se pudo copiar');
    }
  };

  // "2025-05" -> "mayo de 2025"
  const formatMonth = (yyyyMM) => {
    if (!yyyyMM) return '–';
    const [y, m] = String(yyyyMM).split('-').map(Number);
    if (!y || !m) return '–';
    // Evitamos problemas de timezone creando la fecha en UTC
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };

  const formatDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString('es-AR') : '–';

  const formatCurrency = (val) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val ?? 0);

  useEffect(() => {
    const fetchCuotas = async () => {
      setLoading(true);
      try {
        const userId = localStorage.getItem('usuarioId');

        // Esperamos la promesa y normalizamos la respuesta a array
        const res = await apiService.getCuotasUsuario(userId);

        const lista =
          Array.isArray(res) ? res
            : Array.isArray(res?.data) ? res.data
              : Array.isArray(res?.data?.data) ? res.data.data
                : [];

        setCuotas(lista);
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Error al cargar las cuotas.');
        setCuotas([]); // mantené array para no romper el render
      } finally {
        setLoading(false);
      }
    };

    fetchCuotas();
  }, []);

  return (
    <div className="page-layout">
      <SidebarMenu isAdmin={false} />

      <div className="content-layout">
        <h1>Cuotas</h1>

        <div className="cuotas-datos-pagos">
          <h2>Datos de cuenta</h2>
          <div className="cuotas-datos-pagos-info">
            <span style={{ fontWeight: '600' }} className="alias-and-bank">
              {accountHolder}
              {/* <GaliciaIcon width="120" /> */}
            </span>
            {/* <span>
              GIMNASIO GYMHOUR
            </span> */}
            {/* <span>
              <b>ALIAS:</b> {alias}{' '}
              <button className="copy-button" onClick={() => handleCopy(alias)}>
                <Copy size={16} />
              </button>
            </span> */}
            {/* <span>
              <b>CBU:</b> {cbu}{' '}
              <button className="copy-button" onClick={() => handleCopy(cbu)}>
                <Copy width={16} height={16} />
              </button>
            </span> */}
            {/* <span><b>CUIL:</b> {cuil}</span> */}
          </div>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            <button class="cuotas-wsp-btn">Enviar comprobante por WhatsApp</button>
          </a>

        </div>

        <h2>Historial de pagos</h2>
        {loading ? (
          <p style={{ marginTop: '20px' }}>Cargando cuotas...</p>
        ) : error ? (
          <p className="text-error">{error}</p>
        ) : (cuotas?.length ?? 0) === 0 ? (
          <p>No hay cuotas para mostrar.</p>
        ) : (
          <div className="table-responsive">
            <table className="cuotas-table cuotas-table-usuario">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Importe</th>
                  <th>Vence</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Forma de Pago</th>
                  <th>Fecha Pago</th>
                </tr>
              </thead>
              <tbody>
                {cuotas.map((c) => (
                  <tr key={c.ID_Cuota}>
                    <td data-label="Mes" style={{ textTransform: 'uppercase' }}>
                      {formatMonth(c.mes)}
                    </td>
                    <td data-label="Importe" className="col-importe">
                      {formatCurrency(c.importe)}
                    </td>
                    <td data-label="Vence" className="col-vence">
                      {formatDate(c.vence)}
                    </td>
                    <td data-label="Plan" className="col-plan">
                      {c.User?.plan?.nombre ?? '–'}
                    </td>
                    <td data-label="Estado" className="col-estado">
                      <span className={`badge ${c.vencida ? 'expired' : c.pagada ? 'paid' : 'pending'}`}>
                        {c.vencida ? 'Vencida' : c.pagada ? 'Pagada' : 'Pendiente'}
                      </span>
                    </td>
                    <td data-label="Forma de Pago" className="col-forma">
                      {c.formaPago || '–'}
                    </td>
                    <td data-label="Fecha Pago" className="col-fecha">
                      {formatDate(c.fechaPago)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cuotas;