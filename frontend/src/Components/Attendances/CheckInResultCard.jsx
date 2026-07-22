import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { ATTENDANCE_STATUS } from '../../types/attendanceTypes';
import { formatAttendanceDate, formatAttendanceTime } from './attendanceFormatters';
import './CheckInResultCard.css';

const accessText = usage => {
  if (!usage) return '-';
  if (usage.available === null) return 'Ilimitado';
  return usage.available;
};

const CheckInResultCard = ({ result }) => {
  if (!result) {
    return (
      <div className="checkin-placeholder">
        <h3>Resultado del ingreso</h3>
        <p>Verificá un DNI para ver la validación del alumno.</p>
      </div>
    );
  }

  const allowed = result.status === ATTENDANCE_STATUS.ALLOWED;
  const Icon = allowed ? CheckCircle2 : XCircle;

  return (
    <section className={`checkin-result-card ${allowed ? 'allowed' : 'rejected'}`}>
      <div className="checkin-result-header">
        <Icon className="checkin-result-icon" />
        <div>
          <h3>{allowed ? 'Ingreso permitido' : 'Ingreso rechazado'}</h3>
          <p>{result.message}</p>
        </div>
      </div>

      <div className="checkin-result-grid">
        <div>
          <span>Alumno</span>
          <strong>{result.student?.name || '-'}</strong>
        </div>
        <div>
          <span>DNI</span>
          <strong>{result.student?.dni || '-'}</strong>
        </div>
        <div>
          <span>Plan actual</span>
          <strong>{result.plan?.name || '-'}</strong>
        </div>
        <div>
          <span>Accesos usados</span>
          <strong>{result.usage?.used ?? '-'}</strong>
        </div>
        <div>
          <span>Accesos disponibles</span>
          <strong>{accessText(result.usage)}</strong>
        </div>
        <div>
          <span>Fecha y hora</span>
          <strong>
            {result.attendance?.date
              ? `${formatAttendanceDate(result.attendance.date)} ${formatAttendanceTime(result.attendance.date)}`
              : '-'}
          </strong>
        </div>
      </div>
    </section>
  );
};

export default CheckInResultCard;
