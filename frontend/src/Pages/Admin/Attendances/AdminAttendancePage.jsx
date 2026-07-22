import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, SlidersHorizontal } from 'lucide-react';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import AttendanceFilters from '../../../Components/Attendances/AttendanceFilters';
import AttendanceTable from '../../../Components/Attendances/AttendanceTable';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import apiService from '../../../services/apiService';
import './AdminAttendancePage.css';

const emptyFilters = {
  fromDate: '',
  toDate: '',
  student: '',
  dni: '',
  status: '',
  method: '',
};

const AdminAttendancePage = () => {
  const [filters, setFilters] = useState(emptyFilters);
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [attendances, setAttendances] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAttendances = async (currentFilters, currentPage) => {
    setLoading(true);
    setError('');
    try {
      const { items, pagination } = await apiService.getAttendances(currentFilters, { page: currentPage });
      setAttendances(items);
      setTotalPages(pagination?.pages || 1);
    } catch (err) {
      setAttendances([]);
      setTotalPages(1);
      setError(err.message || 'No se pudieron cargar las asistencias.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendances(filters, page);
  }, [filters, page]);

  const goPrevPage = () => setPage(prev => Math.max(1, prev - 1));
  const goNextPage = () => setPage(prev => prev + 1);

  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  const applyFilters = event => {
    event.preventDefault();
    setPage(1);
    setFilters(draftFilters);
  };

  const clearFilters = () => {
    setDraftFilters(emptyFilters);
    setPage(1);
    setFilters(emptyFilters);
  };

  return (
    <div className="page-layout">
      <SidebarMenu isAdmin={true} />
      {loading && <LoaderFullScreen />}
      <main className="content-layout admin-attendance-page">
        <div className="attendance-page-header">
          <div>
            <h2>Asistencia de alumnos</h2>
            <p>Historial visual de ingresos permitidos y rechazados.</p>
          </div>
        </div>

        <div className="attendance-filters-toggle-row">
          <button
            type="button"
            className="attendance-filters-toggle"
            onClick={() => setShowFilters(prev => !prev)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="attendance-filters-count">{activeFiltersCount}</span>
            )}
            {showFilters ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>

        {showFilters && (
          <AttendanceFilters
            filters={draftFilters}
            onChange={setDraftFilters}
            onApply={applyFilters}
            onClear={clearFilters}
          />
        )}

        {error ? (
          <div className="attendance-error-state">
            <h3>Error de carga</h3>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <AttendanceTable
              attendances={attendances}
              emptyMessage="No se encontraron asistencias con los filtros seleccionados."
            />

            <div
              className="paginacion-controls"
              style={{ marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}
            >
              <button
                onClick={goPrevPage}
                disabled={page === 1}
                className="btn-page"
                aria-label="Página anterior"
                title="Página anterior"
              >
                <ChevronLeft />
              </button>
              <span>Página {page}</span>
              <button
                onClick={goNextPage}
                disabled={page >= totalPages}
                className="btn-page"
                aria-label="Página siguiente"
                title="Página siguiente"
              >
                <ChevronRight />
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminAttendancePage;
