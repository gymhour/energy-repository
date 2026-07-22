import React, { useState, useEffect } from 'react'
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu'
import './InicioEntrenador.css'
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton';
import apiService from '../../../services/apiService';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import { toast } from 'react-toastify';
import { SquarePen, Notebook, Users, ArrowRight } from 'lucide-react';

import { Link } from 'react-router-dom';

const InicioEntrenador = () => {

  const [clases, setClases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nombreUsuario, setNombreUsuario] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const usuarioId = localStorage.getItem('usuarioId');
        const [clasesData, usuarioData] = await Promise.all([
          apiService.getClases(),
          apiService.getUserById(usuarioId),
        ]);
        setClases(clasesData);
        setNombreUsuario(`${usuarioData.nombre} ${usuarioData.apellido}`);
        setError('');
      } catch (err) {
        console.error(err);
        setError('Error al cargar los datos. Intente nuevamente.');
        toast.error('Error al cargar los datos. Intente nuevamente.');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);


  const truncateText = (text, maxLength) => {
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + "...";
    }
    return text;
  };


  return (
    <div className='page-layout'>
      {loading && <LoaderFullScreen />}
      <SidebarMenu isAdmin={false} isEntrenador={true} />
      <div className="content-layout">
        <div className="inicio-bienvenida-ctn">
          <h2> ¡Hola, {nombreUsuario}! </h2>
        </div>
        <h3 className='inicio-entrenador-shortcuts-title'> Accesos rápidos </h3>
        <div className="inicio-entrenador-shortcuts">
          <div className="inicio-entrenador-shortcuts-item">
            <Link
              to="/entrenador/asignar-rutinas"
              className="inicio-entrenador-shortcut-link"
            >
              <SquarePen className="icon" /> Asignar Rutinas
            </Link>
          </div>
          <div className="inicio-entrenador-shortcuts-item">
            <Link
              to="/entrenador/rutinas-asignadas"
              className="inicio-entrenador-shortcut-link"
            >
              <Notebook className="icon" /> Ver rutinas asignadas
            </Link>
          </div>
          <div className="inicio-entrenador-shortcuts-item">
            <Link
              to="/entrenador/usuarios"
              className="inicio-entrenador-shortcut-link"
            >
              <Users className="icon" /> Ver usuarios
            </Link>
          </div>
        </div>
        <div className="inicio-clases-act-ctn">
          <div className="inicio-clases-act-title">
            <h3> Clases y actividades </h3>
            <SecondaryButton linkTo="/entrenador/clases-actividades" text="Ver todas" icon={ArrowRight} />
          </div>
          {error ? (
            <p className="error-message">{error}</p>
          ) : (
            <div className="clases-list">
              {clases.length > 0 ? (
                clases.slice(0, 3).map((clase) => (
                  <Link
                    key={clase.ID_Clase}
                    to={`/entrenador/clases-actividades/${clase.ID_Clase}`}
                    className="clase-link"
                  >
                    <div className="clase-item" style={{
                      backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${clase.imagenClase != null
                        ? clase.imagenClase
                        : 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dGhlJTIwZ3ltfGVufDB8fDB8fHww'})`
                    }}>
                      <h2>{clase.nombre}</h2>
                      <p>{truncateText(clase.descripcion, 80)}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <p>No hay clases disponibles.</p>
              )}
            </div>
          )}
        </div>
      </div>    </div>
  )
}

export default InicioEntrenador