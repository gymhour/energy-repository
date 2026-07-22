import React from 'react';
import { ATTENDANCE_STATUS } from '../../types/attendanceTypes';
import { getAttendanceStatusLabel } from './attendanceFormatters';
import './AttendanceStatusBadge.css';

const AttendanceStatusBadge = ({ status }) => {
  const variant = status === ATTENDANCE_STATUS.ALLOWED ? 'allowed' : 'rejected';

  return (
    <span className={`attendance-status-badge ${variant}`}>
      {getAttendanceStatusLabel(status)}
    </span>
  );
};

export default AttendanceStatusBadge;
