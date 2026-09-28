import test from "node:test";
import assert from "node:assert/strict";
import { buildMoraView, calculateMora, getMoraDays, validateMoraRate } from "./mora.service.js";

test("calcula interés simple diario del caso de aceptación", () => {
  const result = calculateMora({
    importe: 30_000,
    tasaDiaria: 0.5,
    vence: new Date("2026-09-10T23:59:59.000Z"),
    calculationDate: new Date("2026-09-15T15:00:00.000Z"),
  });
  assert.deepEqual(result, { dias: 5, interes: 750, total: 30_750 });
});

test("no cobra el día del vencimiento y cobra desde el siguiente", () => {
  const vence = new Date("2026-09-10T23:59:59.000Z");
  assert.equal(getMoraDays(vence, new Date("2026-09-10T12:00:00.000Z")), 0);
  assert.equal(getMoraDays(vence, new Date("2026-09-11T12:00:00.000Z")), 1);
});

test("redondea solo el interés final", () => {
  assert.deepEqual(calculateMora({
    importe: 1000.01,
    tasaDiaria: 0.3333,
    vence: new Date("2026-09-10T23:59:59.000Z"),
    calculationDate: new Date("2026-09-13T12:00:00.000Z"),
  }), { dias: 3, interes: 10, total: 1010.01 });
});

test("valida tasa porcentual con hasta cuatro decimales", () => {
  assert.equal(validateMoraRate("0.5000"), 0.5);
  assert.equal(validateMoraRate("100"), 100);
  assert.equal(validateMoraRate("0.12345"), null);
  assert.equal(validateMoraRate("-1"), null);
});

test("una exención conserva los días de mora pero cobra interés cero", () => {
  const mora = buildMoraView({
    ID_Cuota: 1,
    importe: 30_000,
    vence: new Date("2026-09-10T23:59:59.000Z"),
    pagada: false,
    fechaPago: null,
    moraTasaDiariaBase: 0.5,
    moraTasaDiariaOverride: 0,
    moraFechaInicio: new Date("2026-09-11T03:00:00.000Z"),
    interesMoraPagado: null,
    totalPagado: null,
    diasMoraAlPagar: null,
    tasaMoraAplicadaPago: null,
  }, new Date("2026-09-15T15:00:00.000Z"));
  assert.equal(mora.dias, 5);
  assert.equal(mora.interes, 0);
  assert.equal(mora.total, 30_000);
  assert.equal(mora.estadoTasa, "EXENTA");
});

test("una cuota pagada usa siempre el snapshot congelado", () => {
  const mora = buildMoraView({
    ID_Cuota: 1,
    importe: 30_000,
    vence: new Date("2026-09-10T23:59:59.000Z"),
    pagada: true,
    fechaPago: new Date("2026-09-15T15:00:00.000Z"),
    moraTasaDiariaBase: 0.5,
    moraTasaDiariaOverride: null,
    moraFechaInicio: new Date("2026-09-11T03:00:00.000Z"),
    interesMoraPagado: 750,
    totalPagado: 30_750,
    diasMoraAlPagar: 5,
    tasaMoraAplicadaPago: 0.5,
  }, new Date("2027-09-15T15:00:00.000Z"));
  assert.equal(mora.dias, 5);
  assert.equal(mora.interes, 750);
  assert.equal(mora.total, 30_750);
  assert.equal(mora.congelado, true);
});
