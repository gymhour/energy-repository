export const ATTENDANCE_STATUS = {
  ALLOWED: 'allowed',
  REJECTED: 'rejected',
};

export const ATTENDANCE_METHOD = {
  DNI: 'dni',
  QR: 'qr',
};

export const ACCESS_PERIOD = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  UNLIMITED: 'unlimited',
};

export const ATTENDANCE_REJECT_REASON = {
  STUDENT_NOT_FOUND: 'STUDENT_NOT_FOUND',
  USER_INACTIVE: 'USER_INACTIVE',
  NO_ACTIVE_PLAN: 'NO_ACTIVE_PLAN',
  MEMBERSHIP_EXPIRED: 'MEMBERSHIP_EXPIRED',
  WEEKLY_LIMIT_REACHED: 'WEEKLY_LIMIT_REACHED',
  DUPLICATE_ATTENDANCE: 'DUPLICATE_ATTENDANCE',
};

export const ATTENDANCE_REJECT_REASON_LABELS = {
  [ATTENDANCE_REJECT_REASON.STUDENT_NOT_FOUND]: 'Alumno no encontrado',
  [ATTENDANCE_REJECT_REASON.USER_INACTIVE]: 'Usuario inactivo',
  [ATTENDANCE_REJECT_REASON.NO_ACTIVE_PLAN]: 'Sin plan activo',
  [ATTENDANCE_REJECT_REASON.MEMBERSHIP_EXPIRED]: 'Membresía vencida',
  [ATTENDANCE_REJECT_REASON.WEEKLY_LIMIT_REACHED]: 'Cupo semanal agotado',
  [ATTENDANCE_REJECT_REASON.DUPLICATE_ATTENDANCE]: 'Asistencia duplicada o registrada recientemente',
};

/**
 * @typedef {'allowed' | 'rejected'} AttendanceStatus
 * @typedef {'dni' | 'qr'} AttendanceMethod
 * @typedef {'weekly' | 'monthly' | 'unlimited'} AccessPeriod
 * @typedef {'STUDENT_NOT_FOUND' | 'USER_INACTIVE' | 'NO_ACTIVE_PLAN' | 'MEMBERSHIP_EXPIRED' | 'WEEKLY_LIMIT_REACHED' | 'DUPLICATE_ATTENDANCE'} AttendanceRejectReason
 *
 * @typedef {Object} PlanAccessRules
 * @property {number | null} accessLimit
 * @property {AccessPeriod} accessPeriod
 * @property {boolean} allowUnlimitedAccess
 * @property {number | null} maxAccessesPerPeriod
 * @property {number[]=} allowedDays
 * @property {number=} duplicateCheckMinutes
 *
 * @typedef {Object} Attendance
 * @property {string} id
 * @property {{ id: string, name: string, dni: string }} student
 * @property {{ id: string, name: string } & PlanAccessRules} plan
 * @property {string} date
 * @property {AttendanceMethod} method
 * @property {AttendanceStatus} status
 * @property {AttendanceRejectReason=} reason
 * @property {string=} rejectionReason
 *
 * @typedef {Object} CheckInResult
 * @property {boolean} allowed
 * @property {AttendanceStatus} status
 * @property {string} message
 * @property {AttendanceRejectReason=} reason
 * @property {{ id: string, name: string, dni: string }=} student
 * @property {({ id: string, name: string } & PlanAccessRules)=} plan
 * @property {{ used: number, available: number | null, period: AccessPeriod }=} usage
 * @property {{ id: string, date: string, method: AttendanceMethod }=} attendance
 */
