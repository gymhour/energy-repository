import React, { useEffect, useState } from 'react';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import apiService from '../../../services/apiService';
import '../../../App.css';
import './Entrenadores.css';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';

const Entrenadores = () => {
  const [entrenadores, setEntrenadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const defaultAvatar =
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRGh5WFH8TOIfRKxUrIgJZoDCs1yvQ4hIcppw&s';

  useEffect(() => {
    const fetchEntrenadores = async () => {
      try {
        const data = await apiService.getEntrenadores();
        const activos = data.filter(entrenador => entrenador.estado === true);
        setEntrenadores(activos);
        console.log("Entrenadores activos", activos);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEntrenadores();
  }, []);

  return (
    <div className="page-layout">
      {loading && <LoaderFullScreen />}
      <SidebarMenu isAdmin={false} />

      <div className="content-layout">
        <h2>Entrenadores</h2>
        <p style={{ paddingTop: '12px' }}>
          Conocé a nuestros instructores
        </p>
        <div className="trainers-grid">
          {!loading &&
            !error &&
            entrenadores.map((trainer) => (
              <div className="trainer-item" key={trainer.ID_Usuario}>
                <div
                  className="trainer-card"
                  style={{
                    backgroundImage: `url(${trainer.avatarUrl || defaultAvatar})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                />
                <p style={{ paddingTop: '12px', textAlign: 'center' }}>
                  <strong>{trainer.nombre || 'Nombre'},</strong>{' '}
                  <span className="profesion">
                    {trainer.profesion || 'Profesión'}
                  </span>
                </p>

                {trainer.clasesACargo && trainer.clasesACargo.length > 0 && (
                  <p style={{ marginTop: '7px', textAlign: 'center' }}>
                    <strong>Clases a cargo:</strong>{' '}
                    {trainer.clasesACargo.map(c => c.nombre).join(', ')}
                  </p>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Entrenadores;