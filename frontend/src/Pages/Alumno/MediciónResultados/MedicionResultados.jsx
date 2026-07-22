import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../../App.css';
import './MedicionResultados.css';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import apiService from '../../../services/apiService';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton';
import { Trash2 } from 'lucide-react';
import ConfirmationPopup from '../../../Components/utils/ConfirmationPopUp/ConfirmationPopUp';
import { toast } from 'react-toastify';

const MedicionResultados = () => {
  const [ejercicios, setEjercicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Para el popup de confirmación
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedEjercicioId, setSelectedEjercicioId] = useState(null);

  // Fetch de los ejercicios
  useEffect(() => {
    const fetchEjercicios = async () => {
      try {
        const usuarioId = localStorage.getItem("usuarioId");
        const data = await apiService.getEjerciciosResultadosUsuario(usuarioId);
        setEjercicios(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEjercicios();
  }, []);

  // Función para obtener el máximo de cada ejercicio desde su historial
  const getMaxCantidad = (historico) => {
    if (!historico || historico.length === 0) return 0;
    return historico.reduce(
      (max, item) => (item.Cantidad > max ? item.Cantidad : max),
      0
    );
  };

  // Función para obtener la última cantidad registrada
  const getLastCantidad = (historico) => {
    if (!historico || historico.length === 0) return 0;
    // Ordeno de más reciente a más antiguo
    const sorted = [...historico].sort(
      (a, b) => new Date(b.Fecha) - new Date(a.Fecha)
    );
    return sorted[0].Cantidad;
  };

  // Abre el popup y almacena el ID del ejercicio a eliminar
  const handlePopupOpen = (id) => {
    setSelectedEjercicioId(id);
    setIsPopupOpen(true);
  };

  // Confirma el borrado
  const handlePopupConfirm = async () => {
    setIsPopupOpen(false);
    if (!selectedEjercicioId) return;

    setLoading(true);
    try {
      await apiService.deleteEjercicio(selectedEjercicioId);
      toast.success("Ejercicio eliminado correctamente.");
      setEjercicios((prev) =>
        prev.filter((e) => e.ID_EjercicioMedicion !== selectedEjercicioId)
      );
      setLoading(false);
    } catch (err) {
      toast.error("No se pudo eliminar el ejercicio. Inténtalo nuevamente.");
      console.error("Error al eliminar ejercicio:", err);
      setLoading(false);
    } finally {
      setSelectedEjercicioId(null);
    }
  };

  // Cierra el popup sin borrar nada
  const handlePopupClose = () => {
    setIsPopupOpen(false);
    setSelectedEjercicioId(null);
  };

  if (error) {
    return (
      <div className="page-layout">
        <SidebarMenu isAdmin={false} />
        <div className="content-layout">
          <p>Ocurrió un error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-layout">
      {loading && <LoaderFullScreen />}
      <SidebarMenu isAdmin={false} />
      <div className="content-layout">
        <div className="medicion-resultados-title">
          <h2>Medición de ejercicios</h2>
          <p>Lleva registro de tu progreso en el gimnasio. 💪🏻</p>
        </div>

        <div className="med-resultados-ejercicios-section">
          <div className="med-resultados-ejercicios-header">
            <h2>Ejercicios</h2>
            <PrimaryButton
              text="Agregar ejercicio"
              linkTo={"/alumno/medicion-resultados/nueva-medicion"}
            />
          </div>

          <div className="med-resultados-ejercicios-list">
            {!loading && ejercicios.length === 0 ? (
              <p className="no-ejercicios-message">
                No tienes ejercicios registrados. ¡Agrega uno para comenzar!
              </p>
            ) : (
              ejercicios.map((ejercicio) => {
                // const maxCantidad = getMaxCantidad(ejercicio.HistoricoEjercicios);
                const lastCantidad = getLastCantidad(ejercicio.HistoricoEjercicios);
                return (
                  <Link
                    key={ejercicio.ID_EjercicioMedicion}
                    to={`/alumno/medicion-resultados/ejercicio/${ejercicio.ID_EjercicioMedicion}`}
                    className="med-resultados-card"
                  >
                    <div className="med-resultados-card-content">
                      <div className="med-resultados-card-header">
                        <h3>
                          {lastCantidad}
                          {/* {ejercicio.tipoMedicion === "Cantidad" ? "rps" : "kg"} */}
                        </h3>
                        <span>{ejercicio.tipoMedicion}</span>
                      </div>
                      <div className="med-resultados-card-body">
                        <p>{ejercicio.nombre}</p>
                      </div>
                      {/* Botón de borrar: detiene la propagación y abre el popup */}
                      <button
                        className="borrar-ejercicio-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handlePopupOpen(ejercicio.ID_EjercicioMedicion);
                        }}
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ConfirmationPopup al final del return */}
      <ConfirmationPopup
        isOpen={isPopupOpen}
        onClose={handlePopupClose}
        onConfirm={handlePopupConfirm}
        message="¿Estás seguro de que deseas eliminar este ejercicio?"
      />
    </div>
  );
};

export default MedicionResultados;