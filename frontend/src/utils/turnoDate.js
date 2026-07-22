export const TURNO_CANCEL_MIN_ADVANCE_MS = 60 * 60 * 1000;

export const parseTurnoWallClockDate = (value) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  );
};

export const isTurnoInFuture = (value, now = new Date()) => {
  const turnoDate = parseTurnoWallClockDate(value);
  return turnoDate ? turnoDate > now : false;
};

export const canCancelTurno = (value, now = new Date()) => {
  const turnoDate = parseTurnoWallClockDate(value);
  return turnoDate ? turnoDate.getTime() - now.getTime() >= TURNO_CANCEL_MIN_ADVANCE_MS : false;
};

export const formatTurnoDate = (value) => {
  const date = parseTurnoWallClockDate(value);
  if (!date) return "Fecha no disponible";

  const weekday = date.toLocaleDateString("es-AR", { weekday: "long" });
  const capitalizedWeekday = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`;
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${capitalizedWeekday} ${day}/${month} - ${hours}:${minutes}`;
};
