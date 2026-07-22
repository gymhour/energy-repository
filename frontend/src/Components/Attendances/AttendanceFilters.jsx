import React from 'react';
import CustomDropdown from '../utils/CustomDropdown/CustomDropdown';
import CustomInput from '../utils/CustomInput/CustomInput';
import { ATTENDANCE_METHOD, ATTENDANCE_STATUS } from '../../types/attendanceTypes';
import './AttendanceFilters.css';

const AttendanceFilters = ({ filters, planOptions = [], onChange, onApply, onClear }) => {
  const updateFilter = (name, value) => {
    onChange({ ...filters, [name]: value });
  };

  return (
    <form className="attendance-filters" onSubmit={onApply}>
      <div className="attendance-filter-field">
        <label>Desde</label>
        <CustomInput
          type="date"
          value={filters.fromDate}
          onChange={event => updateFilter('fromDate', event.target.value)}
          width="100%"
        />
      </div>
      <div className="attendance-filter-field">
        <label>Hasta</label>
        <CustomInput
          type="date"
          value={filters.toDate}
          onChange={event => updateFilter('toDate', event.target.value)}
          width="100%"
        />
      </div>
      <div className="attendance-filter-field">
        <label>Alumno</label>
        <CustomInput
          value={filters.student}
          onChange={event => updateFilter('student', event.target.value)}
          placeholder="Buscar alumno"
          width="100%"
        />
      </div>
      <div className="attendance-filter-field">
        <label>DNI</label>
        <CustomInput
          value={filters.dni}
          onChange={event => updateFilter('dni', event.target.value)}
          placeholder="Buscar DNI"
          width="100%"
        />
      </div>
      {planOptions.length > 0 && (
        <div className="attendance-filter-field">
          <label>Plan</label>
          <CustomDropdown
            options={planOptions}
            value={filters.plan}
            onChange={event => updateFilter('plan', event.target.value)}
            placeholderOption="Todos"
            placeholderDisabled={false}
          />
        </div>
      )}
      <div className="attendance-filter-field">
        <label>Estado</label>
        <CustomDropdown
          options={[
            { value: ATTENDANCE_STATUS.ALLOWED, label: 'Permitido' },
            { value: ATTENDANCE_STATUS.REJECTED, label: 'Rechazado' },
          ]}
          value={filters.status}
          onChange={event => updateFilter('status', event.target.value)}
          placeholderOption="Todos"
          placeholderDisabled={false}
        />
      </div>
      <div className="attendance-filter-field">
        <label>Método</label>
        <CustomDropdown
          options={[
            { value: ATTENDANCE_METHOD.QR, label: 'QR' },
            { value: ATTENDANCE_METHOD.DNI, label: 'DNI' },
          ]}
          value={filters.method}
          onChange={event => updateFilter('method', event.target.value)}
          placeholderOption="Todos"
          placeholderDisabled={false}
        />
      </div>
      <div className="attendance-filter-actions">
        <button type="submit" className="attendance-primary-button">
          Aplicar filtros
        </button>
        <button type="button" className="attendance-secondary-button" onClick={onClear}>
          Limpiar filtros
        </button>
      </div>
    </form>
  );
};

export default AttendanceFilters;
