import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useParams } from 'react-router-dom';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import '../../../App.css';
import './MedicionResultadosDetalle.css';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';
import apiClient from '../../../axiosConfig';
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton';
import { ReactComponent as ArrowLeftIcon } from '../../../assets/icons/arrow-left.svg';
import apiService from '../../../services/apiService';
import { toast } from 'react-toastify';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton';
import CustomInput from '../../../Components/utils/CustomInput/CustomInput';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import ConfirmationPopup from '../../../Components/utils/ConfirmationPopUp/ConfirmationPopUp';
import { Edit2, Trash2 } from 'lucide-react';

const MedicionResultadosDetalle = () => {
  const { id } = useParams();
  const [ejercicio, setEjercicio] = useState(null);
  const [loading, setLoading] = useState(true);

  const [nuevaCantidad, setNuevaCantidad] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState('');

  // Para eliminar mediciones
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Para editar mediciones
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [editCantidad, setEditCantidad] = useState('');
  const [editFecha, setEditFecha] = useState('');

  const parseDateString = (dateStr) => {
    if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
    const parts = dateStr.split('-').map(Number);
    let year, month, day;
    if (parts[0] > 31) [year, month, day] = parts;
    else[day, month, year] = parts;
    return new Date(year, month - 1, day);
  };
  const formatAsLocalDate = (d) => parseDateString(d).toLocaleDateString();

  const fetchEjercicio = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/ejercicios-resultados');
      const data = res.data;
      const found = data.find(
        (item) => item.ID_EjercicioMedicion === parseInt(id, 10)
      );
      if (!found) throw new Error('No se encontró el ejercicio');
      setEjercicio(found);
    } catch (err) {
      toast.error(err.message || 'Error al obtener el ejercicio.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEjercicio();
  }, [fetchEjercicio]);

  const historico = ejercicio?.HistoricoEjercicios ?? [];
  const sortedAsc = [...historico].sort(
    (a, b) => new Date(a.Fecha) - new Date(b.Fecha)
  );
  const sortedDesc = [...historico].sort(
    (a, b) => new Date(b.Fecha) - new Date(a.Fecha)
  );
  const dataChart = sortedAsc.map((item) => ({
    fecha: formatAsLocalDate(item.Fecha),
    cantidad: item.Cantidad
  }));

  const handleAgregarResultado = async (e) => {
    e.preventDefault();
    if (!nuevaCantidad || !nuevaFecha) {
      toast.error('Por favor completa todos los campos.');
      return;
    }
    setLoading(true);
    try {
      await apiService.postEjercicioResultado({
        ID_EjercicioMedicion: parseInt(id, 10),
        Cantidad: parseFloat(nuevaCantidad),
        Fecha: nuevaFecha
      });
      const nuevo = {
        ID_HistoricoEjercicio: Date.now(),
        Fecha: nuevaFecha,
        Cantidad: parseFloat(nuevaCantidad),
        ID_EjercicioMedicion: parseInt(id, 10)
      };
      setEjercicio((prev) => ({
        ...prev,
        HistoricoEjercicios: [...prev.HistoricoEjercicios, nuevo]
      }));
      setNuevaCantidad('');
      setNuevaFecha('');
      toast.success('Medición cargada correctamente.');
      await fetchEjercicio();
    } catch (err) {
      toast.error(err.message || 'Error al agregar la medición.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (itemId) => {
    setItemToDelete(itemId);
    setIsPopupOpen(true);
  };
  const closePopup = () => {
    setIsPopupOpen(false);
    setItemToDelete(null);
  };
  const confirmDelete = async () => {
    setLoading(true);
    try {
      await apiService.deleteEjerciciosResultados(itemToDelete);
      setEjercicio((prev) => ({
        ...prev,
        HistoricoEjercicios: prev.HistoricoEjercicios.filter(
          (h) => h.ID_HistoricoEjercicio !== itemToDelete
        )
      }));
      toast.success('Medición eliminada correctamente.');

      await fetchEjercicio();
    } catch (err) {
      toast.error(err.message || 'Error al eliminar la medición.');
    } finally {
      setLoading(false);
      closePopup();
    }
  };

  const handleEditClick = (item) => {
    setItemToEdit(item);
    setEditCantidad(item.Cantidad);
    const dateVal = item.Fecha.includes('T') ? item.Fecha.split('T')[0] : item.Fecha;
    setEditFecha(dateVal);
    setIsEditOpen(true);
  };
  const closeEditPopup = () => {
    setIsEditOpen(false);
    setItemToEdit(null);
  };

  const confirmEdit = async () => {
    if (!itemToEdit) return;

    const body = {
      Cantidad: Number(editCantidad),
      Fecha: editFecha
    };

    setLoading(true);
    try {
      await apiService.putEjercicioResultado(itemToEdit.ID_HistoricoEjercicio, body);

      setEjercicio((prev) => ({
        ...prev,
        HistoricoEjercicios: prev.HistoricoEjercicios.map(h =>
          h.ID_HistoricoEjercicio === itemToEdit.ID_HistoricoEjercicio
            ? { ...h, Cantidad: Number(editCantidad), Fecha: editFecha }
            : h
        )
      }));

      toast.success('Medición actualizada correctamente.');
      closeEditPopup();

      await fetchEjercicio();
    } catch (err) {
      toast.error(err.message || 'Error al actualizar la medición.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-layout">
      <SidebarMenu isAdmin={false} />
      {loading && <LoaderFullScreen />}

      <div className="content-layout detalle-container" aria-busy={loading}>
        <div className="detalle-header">
          <SecondaryButton
            linkTo="/alumno/medicion-resultados"
            text="Volver atrás"
            icon={ArrowLeftIcon}
            reversed
          />
          <h2>
            {ejercicio?.nombre || ''} – {ejercicio?.tipoMedicion || ''}
          </h2>
        </div>

        <div className="detalle-form">
          <h3>Agregar nuevo resultado</h3>
          <form className="editar-medicion-form">
            <div className="editar-medicion-input-ctn">
              <label>Cantidad</label>
              <CustomInput
                type="number"
                placeholder="Ej. 108 (kg) o 40 (reps)"
                value={nuevaCantidad}
                onChange={(e) => setNuevaCantidad(e.target.value)}
              />
            </div>
            <div className="editar-medicion-input-ctn">
              <label>Fecha</label>
              <CustomInput
                type="date"
                value={nuevaFecha}
                onChange={(e) => setNuevaFecha(e.target.value)}
              />
            </div>
            <div className="nuevo-resultado-form-btns">
              <PrimaryButton text="Agregar" onClick={handleAgregarResultado} disabled={loading} />
            </div>
          </form>
        </div>

        <div className="detalle-grafico">
          <h3>Historial</h3>
          {sortedAsc.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dataChart} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e63946" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#e63946" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#444" strokeDasharray="3 3" />
                <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fill: '#aaa', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#aaa', fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(0, 0, 0, 0.7)' }}
                  contentStyle={{
                    backgroundColor: '#000',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
                  }}
                  labelStyle={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff', fontSize: 12 }}
                />
                <Bar
                  name="Cantidad"
                  dataKey="cantidad"
                  fill="url(#barGradient)"
                  radius={[6, 6, 0, 0]}
                  barSize={75}
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p>No hay datos en el historial</p>
          )}
        </div>

        <div className="detalle-tabla">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>{ejercicio?.tipoMedicion === 'Cantidad' ? 'Reps' : 'Kg'}</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedDesc.map((item) => (
                <tr key={item.ID_HistoricoEjercicio}>
                  <td>{formatAsLocalDate(item.Fecha)}</td>
                  <td>{item.Cantidad}</td>
                  <td>
                    <div className="medicion-detalle-actions">
                      <button
                        type="button"
                        onClick={() => handleEditClick(item)}
                        style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}
                        title="Editar"
                        disabled={loading}
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(item.ID_HistoricoEjercicio)}
                        style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: 0, marginLeft: 8 }}
                        title="Eliminar"
                        disabled={loading}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmationPopup
        isOpen={isPopupOpen}
        onClose={closePopup}
        onConfirm={confirmDelete}
        message="¿Estás seguro que deseas eliminar esta medición?"
      />

      {isEditOpen &&
        ReactDOM.createPortal(
          <div className="edit-popup-overlay">
            <div className="edit-popup">
              <h3>Editar medición</h3>
              <div className="edit-popup-fields">
                <div className="field-ctn">
                  <label>Cantidad</label>
                  <CustomInput
                    type="number"
                    value={editCantidad}
                    onChange={(e) => setEditCantidad(e.target.value)}
                  />
                </div>
                <div className="field-ctn">
                  <label>Fecha</label>
                  <CustomInput
                    type="date"
                    value={editFecha}
                    onChange={(e) => setEditFecha(e.target.value)}
                  />
                </div>
              </div>
              <div className="edit-popup-buttons">
                <SecondaryButton onClick={closeEditPopup} text="Cancelar" />
                <PrimaryButton onClick={confirmEdit} text="Confirmar" disabled={loading} />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default MedicionResultadosDetalle;