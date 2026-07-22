import React, { useEffect, useState } from 'react';
import '../../../App.css';
import '../CuotasUsuarios/CuotasUsuarios.css';
import './Gastos.css';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton';
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton';
import CustomInput from '../../../Components/utils/CustomInput/CustomInput';
import CustomDropdown from '../../../Components/utils/CustomDropdown/CustomDropdown';
import ConfirmationPopup from '../../../Components/utils/ConfirmationPopUp/ConfirmationPopUp';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, SlidersHorizontal, X } from 'lucide-react';
import apiService from '../../../services/apiService';
import { toast } from 'react-toastify';

const CATEGORIAS = ['Alquiler', 'Sueldos', 'Insumos', 'Servicios', 'Marketing', 'Impuestos', 'Otros'];

const Gastos = () => {
  // — Datos / carga —
  const [gastos, setGastos] = useState([]);
  const [meta, setMeta] = useState({ totalItems: 0, totalPages: 1, totalMonto: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // — Modal crear/editar —
  const [showModal, setShowModal] = useState(false);
  const [selectedGasto, setSelectedGasto] = useState(null); // null = crear
  const [formFecha, setFormFecha] = useState(null);
  const [formCategoria, setFormCategoria] = useState('');
  const [formMonto, setFormMonto] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');

  // — Confirmación eliminar —
  const [popupOpen, setPopupOpen] = useState(false);
  const [gastoToDelete, setGastoToDelete] = useState(null);

  // — Filtros (inputs) —
  const [inputCategoria, setInputCategoria] = useState('');
  const [inputMesDate, setInputMesDate] = useState(null);
  const [inputDesde, setInputDesde] = useState(null);
  const [inputHasta, setInputHasta] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // — Filtros aplicados + paginación —
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterMesDate, setFilterMesDate] = useState(null);
  const [filterDesde, setFilterDesde] = useState(null);
  const [filterHasta, setFilterHasta] = useState(null);
  const [page, setPage] = useState(1);

  // — Helpers de fecha —
  const buildMesString = (dateObj) => {
    if (!dateObj) return '';
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    return `${year}-${month < 10 ? '0' + month : month}`;
  };

  // Construye ISO a mediodía UTC para evitar drift de día entre zonas horarias.
  const toIsoUtcNoon = (localDate) => {
    if (!localDate) return null;
    return new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 12, 0, 0)).toISOString();
  };

  // ISO (mediodía UTC) → Date local del día correcto para el datepicker.
  const dateFromIso = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };

  const formatMonth = (m) => {
    if (!m) return '–';
    const [year, month] = m.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleString('es-AR', { month: 'long', year: 'numeric' });
  };
  const formatDate = (iso) => {
    if (!iso) return '–';
    const d = new Date(iso);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  };
  const formatCurrency = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val || 0);

  const datePickerMesClass = 'custom-datepicker custom-datepicker-mes';

  const fetchGastos = async () => {
    setLoading(true);
    try {
      const data = await apiService.getGastos({
        page,
        categoria: filterCategoria || undefined,
        mes: filterMesDate ? buildMesString(filterMesDate) : undefined,
        fechaDesde: filterDesde ? toIsoUtcNoon(filterDesde) : undefined,
        fechaHasta: filterHasta ? toIsoUtcNoon(filterHasta) : undefined,
      });
      setGastos(Array.isArray(data?.data) ? data.data : []);
      setMeta(data?.meta || { totalItems: 0, totalPages: 1, totalMonto: 0 });
      setError(null);
    } catch (err) {
      console.error('Error al obtener gastos:', err);
      setError(err);
      setGastos([]);
      setMeta({ totalItems: 0, totalPages: 1, totalMonto: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGastos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterCategoria, filterMesDate, filterDesde, filterHasta]);

  // — Filtros —
  const applyFilters = () => {
    setPage(1);
    setFilterCategoria(inputCategoria);
    setFilterMesDate(inputMesDate);
    setFilterDesde(inputDesde);
    setFilterHasta(inputHasta);
  };

  const clearFilters = () => {
    setInputCategoria('');
    setInputMesDate(null);
    setInputDesde(null);
    setInputHasta(null);
    setPage(1);
    setFilterCategoria('');
    setFilterMesDate(null);
    setFilterDesde(null);
    setFilterHasta(null);
  };

  // — Modal crear/editar —
  const openCreate = () => {
    setSelectedGasto(null);
    setFormFecha(null);
    setFormCategoria('');
    setFormMonto('');
    setFormDescripcion('');
    setShowModal(true);
  };

  const openEdit = (g) => {
    setSelectedGasto(g);
    setFormFecha(dateFromIso(g.fecha));
    setFormCategoria(g.categoria || '');
    setFormMonto(String(g.monto ?? ''));
    setFormDescripcion(g.descripcion || '');
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formFecha) { toast.error('Seleccioná una fecha.'); return; }
    if (!formCategoria) { toast.error('Seleccioná una categoría.'); return; }
    const montoNum = Number(formMonto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) { toast.error('Ingresá un monto válido (mayor a 0).'); return; }

    const payload = {
      fecha: toIsoUtcNoon(formFecha),
      categoria: formCategoria,
      monto: montoNum,
      descripcion: formDescripcion.trim() || null,
    };

    setLoading(true);
    try {
      if (selectedGasto) {
        await apiService.updateGasto(selectedGasto.ID_Gasto, payload);
        toast.success('Gasto actualizado correctamente.');
      } else {
        await apiService.createGasto(payload);
        toast.success('Gasto creado correctamente.');
      }
      setShowModal(false);
      setPage(1);
      await fetchGastos();
    } catch (err) {
      console.error('Error al guardar gasto:', err);
      toast.error(err.message || 'No se pudo guardar el gasto.');
    } finally {
      setLoading(false);
    }
  };

  // — Eliminar —
  const openDelete = (g) => {
    setGastoToDelete(g);
    setPopupOpen(true);
  };
  const closeDelete = () => {
    setPopupOpen(false);
    setGastoToDelete(null);
  };
  const handleDelete = async () => {
    if (!gastoToDelete) return;
    setLoading(true);
    try {
      await apiService.deleteGasto(gastoToDelete.ID_Gasto);
      toast.success('Gasto eliminado correctamente.');
      closeDelete();
      await fetchGastos();
    } catch (err) {
      console.error('Error al eliminar gasto:', err);
      toast.error(err.message || 'No se pudo eliminar el gasto.');
    } finally {
      setLoading(false);
    }
  };

  // — Paginación —
  const totalPages = meta?.totalPages || 1;
  const goPrevPage = () => { if (page > 1) setPage(prev => prev - 1); };
  const goNextPage = () => { if (page < totalPages) setPage(prev => prev + 1); };

  return (
    <div className="page-layout">
      {loading && <LoaderFullScreen />}
      <SidebarMenu isAdmin={true} />

      <div className="content-layout">
        <div className="header-actions cuotas-usuarios" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Salidas de dinero</h2>
          <div className="generate-cuotas-btns">
            <PrimaryButton text="Nuevo gasto" onClick={openCreate} />
          </div>
        </div>

        <div style={{ margin: '30px 0px' }}>
          <button className="toggle-filters-button" onClick={() => setShowFilters(prev => !prev)}>
            <SlidersHorizontal /> Filtros {showFilters ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>

        {showFilters && (
          <div className="filtros-form">
            <div className="usuarios-filtros-form-inputs-ctn">
              <label htmlFor="inputCategoria">Categoría:</label>
              <CustomDropdown
                id="inputCategoria"
                options={CATEGORIAS}
                placeholderOption="— Todas —"
                placeholderDisabled={false}
                value={inputCategoria}
                onChange={e => setInputCategoria(e.target.value)}
              />
            </div>

            <div className="usuarios-filtros-form-inputs-ctn">
              <label>Mes:</label>
              <ReactDatePicker
                selected={inputMesDate}
                onChange={date => setInputMesDate(date)}
                dateFormat="MM/yyyy"
                showMonthYearPicker
                placeholderText="MM/AAAA"
                className={datePickerMesClass}
                isClearable
              />
            </div>

            <div className="usuarios-filtros-form-inputs-ctn">
              <label>Desde:</label>
              <ReactDatePicker
                selected={inputDesde}
                onChange={date => setInputDesde(date)}
                dateFormat="dd/MM/yyyy"
                placeholderText="DD/MM/AAAA"
                className="custom-datepicker"
                isClearable
              />
            </div>

            <div className="usuarios-filtros-form-inputs-ctn">
              <label>Hasta:</label>
              <ReactDatePicker
                selected={inputHasta}
                onChange={date => setInputHasta(date)}
                dateFormat="dd/MM/yyyy"
                placeholderText="DD/MM/AAAA"
                className="custom-datepicker"
                isClearable
              />
            </div>

            <div className="usuarios-filtros-form-ctn">
              <PrimaryButton onClick={applyFilters} text="Aplicar filtros" />
              <SecondaryButton onClick={clearFilters} text="Limpiar filtros" />
            </div>
          </div>
        )}

        {/* — Total del período — */}
        <div className="gastos-total">
          <span>Total del período:</span>
          <strong>{formatCurrency(meta?.totalMonto)}</strong>
        </div>

        {/* — Tabla — */}
        {loading ? (
          <p>Cargando gastos...</p>
        ) : error ? (
          <p className="text-error">Error cargando datos.</p>
        ) : gastos.length === 0 ? (
          <p>No hay gastos para mostrar.</p>
        ) : (
          <div className="table-responsive">
            <table className="cuotas-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Mes</th>
                  <th>Categoría</th>
                  <th>Monto</th>
                  <th>Descripción</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {gastos.map(g => (
                  <tr key={g.ID_Gasto}>
                    <td data-label="Fecha">{formatDate(g.fecha)}</td>
                    <td data-label="Mes" className="cuotas-usuario-mes-col">{formatMonth(g.mes)}</td>
                    <td data-label="Categoría">
                      <span className="badge gasto-categoria-badge">{g.categoria}</span>
                    </td>
                    <td data-label="Monto">{formatCurrency(g.monto)}</td>
                    <td data-label="Descripción">{g.descripcion ? g.descripcion : '–'}</td>
                    <td data-label="Acciones" className="acciones-cell">
                      <button
                        className="accion-button primary"
                        onClick={() => openEdit(g)}
                        aria-label={`Editar gasto ${g.ID_Gasto}`}
                        title="Editar"
                      >
                        Editar
                      </button>
                      <button
                        className="accion-button delete"
                        onClick={() => openDelete(g)}
                        aria-label={`Eliminar gasto ${g.ID_Gasto}`}
                        title="Eliminar"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* — Paginación — */}
        <div className="paginacion-controls" style={{ marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={goPrevPage} disabled={page === 1} className="btn-page" aria-label="Página anterior" title="Página anterior">
            <ChevronLeft />
          </button>
          <span>Página {page}{totalPages > 1 ? ` de ${totalPages}` : ''}</span>
          <button onClick={goNextPage} disabled={page >= totalPages} className="btn-page" aria-label="Página siguiente" title="Página siguiente">
            <ChevronRight />
          </button>
        </div>
      </div>

      {/* — Modal crear/editar — */}
      {showModal && (
        <div
          className="cuotas-modal-overlay"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}
        >
          <div className="cuotas-modal" role="dialog" aria-modal="true" aria-labelledby="gastos-modal-title">
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="cuotas-modal-header">
                <div>
                  <h3 id="gastos-modal-title">{selectedGasto ? 'Editar gasto' : 'Nuevo gasto'}</h3>
                  <span>{selectedGasto ? 'Modificá los datos del gasto.' : 'Registrá una salida de dinero del gimnasio.'}</span>
                </div>
                <button type="button" className="cuotas-modal-close" onClick={closeModal} aria-label="Cerrar modal">
                  <X size={18} />
                </button>
              </div>

              <div className="cuotas-modal-grid">
                <div className="cuotas-modal-field">
                  <label>Fecha</label>
                  <ReactDatePicker
                    selected={formFecha}
                    onChange={date => setFormFecha(date)}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Seleccioná la fecha"
                    className="custom-datepicker"
                    required
                  />
                </div>

                <div className="cuotas-modal-field">
                  <label>Categoría</label>
                  <CustomDropdown
                    options={CATEGORIAS}
                    placeholderOption="Seleccioná categoría"
                    placeholderDisabled={true}
                    value={formCategoria}
                    onChange={e => setFormCategoria(e.target.value)}
                  />
                </div>

                <div className="cuotas-modal-field cuotas-modal-field-wide">
                  <label>Monto</label>
                  <CustomInput
                    type="number"
                    placeholder="50000"
                    value={formMonto}
                    onChange={e => setFormMonto(e.target.value)}
                    required
                    width="100%"
                  />
                </div>

                <div className="cuotas-modal-field cuotas-modal-field-wide">
                  <label>Descripción (opcional)</label>
                  <textarea
                    className="custom-input gastos-modal-textarea"
                    placeholder="Detalle del gasto…"
                    value={formDescripcion}
                    onChange={e => setFormDescripcion(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <div className="cuotas-modal-actions">
                <button type="button" className="cuotas-modal-secondary-button" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="cuotas-modal-primary-button">
                  {selectedGasto ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* — Confirmar eliminar — */}
      <ConfirmationPopup
        isOpen={popupOpen}
        onClose={closeDelete}
        onConfirm={handleDelete}
        message={`¿Estás seguro de eliminar este gasto${gastoToDelete ? ` de ${formatCurrency(gastoToDelete.monto)} (${gastoToDelete.categoria})` : ''}?`}
      />
    </div>
  );
};

export default Gastos;
