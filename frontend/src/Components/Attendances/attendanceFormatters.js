import { ATTENDANCE_METHOD, ATTENDANCE_STATUS, ATTENDANCE_REJECT_REASON_LABELS } from '../../types/attendanceTypes';

const ATTENDANCE_DISPLAY_TIME_ZONE = 'UTC';

export const formatAttendanceDate = isoDate => {
  if (!isoDate) return '-';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: ATTENDANCE_DISPLAY_TIME_ZONE,
  }).format(new Date(isoDate));
};

export const formatAttendanceTime = isoDate => {
  if (!isoDate) return '-';
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ATTENDANCE_DISPLAY_TIME_ZONE,
  }).format(new Date(isoDate));
};

export const getAttendanceStatusLabel = status => (
  status === ATTENDANCE_STATUS.ALLOWED ? 'Permitido' : 'Rechazado'
);

export const getAttendanceMethodLabel = method => (
  method === ATTENDANCE_METHOD.QR ? 'QR' : 'DNI'
);

export const getRejectReasonLabel = attendance => (
  attendance?.rejectionReason || ATTENDANCE_REJECT_REASON_LABELS[attendance?.reason] || '-'
);
