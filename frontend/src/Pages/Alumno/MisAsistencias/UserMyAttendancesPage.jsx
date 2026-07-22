import React, { useEffect, useState } from 'react';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import AttendanceTable from '../../../Components/Attendances/AttendanceTable';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import apiService from '../../../services/apiService';
import './UserMyAttendancesPage.css';

const UserMyAttendancesPage = () => {
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiService.getMyAttendances();
        setAttendances(data.attendances);
      } catch (err) {
        setError(err.message || 'No se pudieron cargar tus asistencias.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <div className="page-layout">
      <SidebarMenu />
      {loading && <LoaderFullScreen />}
      <main className="content-layout my-attendances-page">
        <div className="attendance-page-header">
          <div>
            <h2>Mis asistencias</h2>
            <p>Historial de ingresos registrados en tu cuenta.</p>
          </div>
        </div>

        {error ? (
          <div className="attendance-error-state">
            <h3>Error de carga</h3>
            <p>{error}</p>
          </div>
        ) : (
          <AttendanceTable
            attendances={attendances}
            emptyMessage="Todavía no tenés asistencias registradas."
          />
        )}
      </main>
    </div>
  );
};

export default UserMyAttendancesPage;
