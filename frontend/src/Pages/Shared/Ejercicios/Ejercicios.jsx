import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import apiService from '../../../services/apiService';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import ConfirmationPopup from '../../../Components/utils/ConfirmationPopUp/ConfirmationPopUp';
import CustomInput from '../../../Components/utils/CustomInput/CustomInput';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton';
import './Ejercicios.css';
import EjercicioCard from '../../../Components/EjercicioCard/EjercicioCard';

const Ejercicios = ({ fromAdmin, fromEntrenador, fromAlumno }) => {
  const navigate = useNavigate();
  const defaultImage =
    'https://coffective.com/wp-content/uploads/2018/06/default-featured-image.png.jpg';

  const [loading, setLoading] = useState(false);
  const [ejercicios, setEjercicios] = useState([]);
  const [toDelete, setToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrado por búsqueda
  const filteredEjercicios = useMemo(() => {
    if (!searchTerm) return ejercicios;
    const term = searchTerm.toLowerCase();
    return ejercicios.filter(e =>
      e.nombre?.toLowerCase().includes(term)
    );
  }, [ejercicios, searchTerm]);

  // Obtener y ordenar ejercicios
  const fetchEjercicios = async () => {
    setLoading(true);
    try {
      const data = await apiService.getEjercicios();
      const sorted = [...data].sort((a, b) =>
        (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })
      );
      setEjercicios(sorted);
    } catch (err) {
      console.error(err);
      toast.error('No se pudieron cargar los ejercicios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEjercicios();
  }, []);

  // Agrupar alfabéticamente
  const grouped = useMemo(() => {
    return filteredEjercicios.reduce((acc, e) => {
      const letter = (e.nombre || '')[0]?.toUpperCase() || '';
      if (!letter) return acc;
      (acc[letter] ||= []).push(e);
      return acc;
    }, {});
  }, [filteredEjercicios]);

  // Borrar ejercicio
  const openDeletePopup = ejercicio => setToDelete(ejercicio);
  const closeDeletePopup = () => setToDelete(null);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setLoading(true);
    try {
      await apiService.deleteEjercicios(toDelete.ID_Ejercicio);
      toast.success(`Ejercicio "${toDelete.nombre}" eliminado.`);
      await fetchEjercicios();
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar ejercicio.');
    } finally {
      setLoading(false);
      closeDeletePopup();
    }
  };

  // Base de rutas según rol
  const basePath = fromAdmin
    ? '/admin/ejercicios'
    : fromEntrenador
      ? '/entrenador/ejercicios'
      : fromAlumno
        ? '/alumno/ejercicios'
        : '/ejercicios';

  return (
    <div className='page-layout'>
      <SidebarMenu
        isAdmin={fromAdmin}
        isEntrenador={fromEntrenador}
        isAlumno={fromAlumno}
      />

      {loading && <LoaderFullScreen />}

      <div className='content-layout'>
        <div className='exercises-header'>
          <h2>Lista de Ejercicios</h2>
          {(fromAdmin || fromEntrenador) && (
            <PrimaryButton
              text='Nuevo ejercicio'
              linkTo={`${basePath}/form`}
            />
          )}
        </div>

        <CustomInput
          type='text'
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder='Buscar ejercicios...'
        />

        <div className='ejercicios-list'>
          {Object.keys(grouped)
            .sort()
            .map(letter => (
              <div key={letter} className='exercise-group'>
                <h2 className='exercise-group__letter'>{letter}</h2>
                <div className='exercise-group__grid'>
                  {grouped[letter].map(e => (
                    <EjercicioCard
                      key={e.ID_Ejercicio}
                      ejercicio={e}
                      defaultImage={defaultImage}
                      onClick={() => navigate(`${basePath}/${e.ID_Ejercicio}`)}
                      {...(fromAdmin || fromEntrenador
                        ? {
                          onEdit: () => navigate(`${basePath}/form/${e.ID_Ejercicio}`),
                          onDelete: () => openDeletePopup(e),
                        }
                        : {}
                      )}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>

      {(fromAdmin || fromEntrenador) && toDelete && (
        <ConfirmationPopup
          isOpen={!!toDelete}
          message={`¿Está seguro que quiere eliminar el ejercicio "${toDelete.nombre}"?`}
          onClose={closeDeletePopup}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
};

export default Ejercicios;