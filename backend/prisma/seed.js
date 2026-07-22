import { PrismaClient, BlockType } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function hash(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function main() {
  console.log("🌱  Iniciando seed...");

  // ─────────────────────────────────────────────
  // PLANES
  // ─────────────────────────────────────────────
  const planBasico = await prisma.plan.upsert({
    where: { nombre: "Plan Básico" },
    update: {},
    create: { nombre: "Plan Básico", desc: "Acceso a sala de musculación de lunes a viernes.", precio: 15000 },
  });
  const planPremium = await prisma.plan.upsert({
    where: { nombre: "Plan Premium" },
    update: {},
    create: { nombre: "Plan Premium", desc: "Sala de musculación + clases grupales ilimitadas.", precio: 22000 },
  });
  const planFull = await prisma.plan.upsert({
    where: { nombre: "Plan Full" },
    update: {},
    create: { nombre: "Plan Full", desc: "Acceso total: sala, clases, seguimiento personalizado.", precio: 30000 },
  });
  console.log("✅  Planes creados");

  // ─────────────────────────────────────────────
  // USUARIOS
  // ─────────────────────────────────────────────

  // ADMIN
  const admin = await prisma.user.upsert({
    where: { email: "admin@gymhour.com" },
    update: { dni: "30000001" },
    create: {
      dni: "30000001",
      email: "admin@gymhour.com",
      nombre: "Pedro",
      apellido: "Administrador",
      password: await hash("Admin1234!"),
      tipo: "admin",
      tel: "351-000-0001",
      direc: "Av. Colón 1234, Córdoba",
      estado: true,
      fechaCumple: new Date("1990-05-15"),
    },
  });

  // ENTRENADORES
  const entrenador1 = await prisma.user.upsert({
    where: { email: "entrenador@gymhour.com" },
    update: { dni: "30000002" },
    create: {
      dni: "30000002",
      email: "entrenador@gymhour.com",
      nombre: "Lucas",
      apellido: "Fernández",
      password: await hash("Entrenador1234!"),
      tipo: "entrenador",
      profesion: "Licenciado en Educación Física",
      tel: "351-000-0002",
      direc: "Bv. San Juan 567, Córdoba",
      estado: true,
      fechaCumple: new Date("1988-03-22"),
    },
  });
  const entrenador2 = await prisma.user.upsert({
    where: { email: "entrenador2@gymhour.com" },
    update: { dni: "30000003" },
    create: {
      dni: "30000003",
      email: "entrenador2@gymhour.com",
      nombre: "Valentina",
      apellido: "Gómez",
      password: await hash("Entrenador1234!"),
      tipo: "entrenador",
      profesion: "Profesora de Yoga y Funcional",
      tel: "351-000-0003",
      direc: "Calle Lima 89, Córdoba",
      estado: true,
      fechaCumple: new Date("1993-11-08"),
    },
  });

  // ALUMNOS
  const alumno1 = await prisma.user.upsert({
    where: { email: "alumno1@gymhour.com" },
    update: { dni: "40000001" },
    create: {
      dni: "40000001",
      email: "alumno1@gymhour.com",
      nombre: "Mateo",
      apellido: "Rodríguez",
      password: await hash("Alumno1234!"),
      tipo: "cliente",
      tel: "351-100-0001",
      direc: "Calle 9 de Julio 321, Córdoba",
      estado: true,
      fechaCumple: new Date("2000-07-10"),
      ID_Plan: planPremium.ID_Plan,
    },
  });
  const alumno2 = await prisma.user.upsert({
    where: { email: "alumno2@gymhour.com" },
    update: { dni: "40000002" },
    create: {
      dni: "40000002",
      email: "alumno2@gymhour.com",
      nombre: "Sofía",
      apellido: "López",
      password: await hash("Alumno1234!"),
      tipo: "cliente",
      tel: "351-100-0002",
      direc: "Av. Vélez Sársfield 1456, Córdoba",
      estado: true,
      fechaCumple: new Date("1998-02-28"),
      ID_Plan: planFull.ID_Plan,
    },
  });
  const alumno3 = await prisma.user.upsert({
    where: { email: "alumno3@gymhour.com" },
    update: { dni: "40000003" },
    create: {
      dni: "40000003",
      email: "alumno3@gymhour.com",
      nombre: "Tomás",
      apellido: "Pérez",
      password: await hash("Alumno1234!"),
      tipo: "cliente",
      tel: "351-100-0003",
      direc: "Calle Caseros 78, Córdoba",
      estado: true,
      fechaCumple: new Date("2003-12-01"),
      ID_Plan: planBasico.ID_Plan,
    },
  });
  const alumno4 = await prisma.user.upsert({
    where: { email: "alumno4@gymhour.com" },
    update: { dni: "40000004" },
    create: {
      dni: "40000004",
      email: "alumno4@gymhour.com",
      nombre: "Camila",
      apellido: "Martínez",
      password: await hash("Alumno1234!"),
      tipo: "cliente",
      tel: "351-100-0004",
      direc: "Bv. Chacabuco 200, Córdoba",
      estado: false, // cuenta inactiva (para probar el caso)
      fechaCumple: new Date("1995-09-19"),
      ID_Plan: planBasico.ID_Plan,
    },
  });
  console.log("✅  Usuarios creados");

  // ─────────────────────────────────────────────
  // CUOTAS
  // ─────────────────────────────────────────────
  const cuotasData = [
    // Alumno 1 — marzo pagada, abril pagada, mayo pendiente
    { mes: "2026-03", importe: 22000, vence: new Date("2026-03-10"), pagada: true, formaPago: "Efectivo", fechaPago: new Date("2026-03-05"), vencida: false, ID_Usuario: alumno1.ID_Usuario },
    { mes: "2026-04", importe: 22000, vence: new Date("2026-04-10"), pagada: true, formaPago: "Transferencia", fechaPago: new Date("2026-04-08"), vencida: false, ID_Usuario: alumno1.ID_Usuario },
    { mes: "2026-05", importe: 22000, vence: new Date("2026-05-10"), pagada: false, vencida: false, ID_Usuario: alumno1.ID_Usuario },
    // Alumno 2 — todas pagas
    { mes: "2026-03", importe: 30000, vence: new Date("2026-03-10"), pagada: true, formaPago: "Débito", fechaPago: new Date("2026-03-02"), vencida: false, ID_Usuario: alumno2.ID_Usuario },
    { mes: "2026-04", importe: 30000, vence: new Date("2026-04-10"), pagada: true, formaPago: "Débito", fechaPago: new Date("2026-04-01"), vencida: false, ID_Usuario: alumno2.ID_Usuario },
    { mes: "2026-05", importe: 30000, vence: new Date("2026-05-10"), pagada: false, vencida: false, ID_Usuario: alumno2.ID_Usuario },
    // Alumno 3 — vencida y pendiente
    { mes: "2026-03", importe: 15000, vence: new Date("2026-03-10"), pagada: false, vencida: true, ID_Usuario: alumno3.ID_Usuario },
    { mes: "2026-04", importe: 15000, vence: new Date("2026-04-10"), pagada: false, vencida: true, ID_Usuario: alumno3.ID_Usuario },
    { mes: "2026-05", importe: 15000, vence: new Date("2026-05-10"), pagada: false, vencida: false, ID_Usuario: alumno3.ID_Usuario },
  ];
  await prisma.cuota.createMany({ data: cuotasData, skipDuplicates: true });
  console.log("✅  Cuotas creadas");

  // ─────────────────────────────────────────────
  // CLASES + HORARIOS
  // ─────────────────────────────────────────────
  const mkTime = (h, m = 0) => new Date(Date.UTC(2000, 0, 3, h, m, 0)); // fecha base fija, solo importa hora

  const crossfit = await prisma.clase.upsert({
    where: { ID_Clase: 1 },
    update: {},
    create: {
      nombre: "CrossFit",
      descripcion: "Entrenamiento funcional de alta intensidad con movimientos variados.",
      HorariosClase: {
        create: [
          { diaSemana: "Lunes",     horaIni: mkTime(7),  horaFin: mkTime(8),  cupos: 15, activo: true },
          { diaSemana: "Miércoles", horaIni: mkTime(7),  horaFin: mkTime(8),  cupos: 15, activo: true },
          { diaSemana: "Viernes",   horaIni: mkTime(7),  horaFin: mkTime(8),  cupos: 15, activo: true },
          { diaSemana: "Lunes",     horaIni: mkTime(19), horaFin: mkTime(20), cupos: 20, activo: true },
          { diaSemana: "Miércoles", horaIni: mkTime(19), horaFin: mkTime(20), cupos: 20, activo: true },
        ],
      },
      Entrenadores: { connect: { ID_Usuario: entrenador1.ID_Usuario } },
    },
  });

  const yoga = await prisma.clase.upsert({
    where: { ID_Clase: 2 },
    update: {},
    create: {
      nombre: "Yoga",
      descripcion: "Práctica de posturas, respiración y meditación para el equilibrio cuerpo-mente.",
      HorariosClase: {
        create: [
          { diaSemana: "Martes",  horaIni: mkTime(9),  horaFin: mkTime(10), cupos: 12, activo: true },
          { diaSemana: "Jueves",  horaIni: mkTime(9),  horaFin: mkTime(10), cupos: 12, activo: true },
          { diaSemana: "Sábado",  horaIni: mkTime(10), horaFin: mkTime(11), cupos: 10, activo: true },
        ],
      },
      Entrenadores: { connect: { ID_Usuario: entrenador2.ID_Usuario } },
    },
  });

  const spinning = await prisma.clase.upsert({
    where: { ID_Clase: 3 },
    update: {},
    create: {
      nombre: "Spinning",
      descripcion: "Ciclismo indoor de alta intensidad al ritmo de la música.",
      HorariosClase: {
        create: [
          { diaSemana: "Lunes",     horaIni: mkTime(18), horaFin: mkTime(19), cupos: 20, activo: true },
          { diaSemana: "Miércoles", horaIni: mkTime(18), horaFin: mkTime(19), cupos: 20, activo: true },
          { diaSemana: "Viernes",   horaIni: mkTime(18), horaFin: mkTime(19), cupos: 20, activo: true },
        ],
      },
      Entrenadores: { connect: { ID_Usuario: entrenador1.ID_Usuario } },
    },
  });

  const funcional = await prisma.clase.upsert({
    where: { ID_Clase: 4 },
    update: {},
    create: {
      nombre: "Entrenamiento Funcional",
      descripcion: "Circuitos con peso corporal y accesorios para mejorar fuerza y resistencia.",
      HorariosClase: {
        create: [
          { diaSemana: "Lunes",   horaIni: mkTime(20), horaFin: mkTime(21), cupos: 18, activo: true },
          { diaSemana: "Martes",  horaIni: mkTime(20), horaFin: mkTime(21), cupos: 18, activo: true },
          { diaSemana: "Jueves",  horaIni: mkTime(20), horaFin: mkTime(21), cupos: 18, activo: true },
        ],
      },
      Entrenadores: { connect: { ID_Usuario: entrenador2.ID_Usuario } },
    },
  });
  console.log("✅  Clases y horarios creados");

  // ─────────────────────────────────────────────
  // TURNOS (alumnos reservando clases)
  // ─────────────────────────────────────────────
  const horariosCrossfit = await prisma.horarioClase.findMany({ where: { ID_Clase: crossfit.ID_Clase } });
  const horariosYoga     = await prisma.horarioClase.findMany({ where: { ID_Clase: yoga.ID_Clase } });

  if (horariosCrossfit.length > 0) {
    await prisma.turno.createMany({
      data: [
        {
          fecha: new Date("2026-05-05T07:00:00Z"),
          estado: "confirmado",
          fechaCreacion: new Date("2026-05-01T10:00:00Z"),
          ID_HorarioClase: horariosCrossfit[0].ID_HorarioClase,
          ID_Usuario: alumno1.ID_Usuario,
        },
        {
          fecha: new Date("2026-05-07T07:00:00Z"),
          estado: "confirmado",
          fechaCreacion: new Date("2026-05-01T10:05:00Z"),
          ID_HorarioClase: horariosCrossfit[1].ID_HorarioClase,
          ID_Usuario: alumno2.ID_Usuario,
        },
      ],
      skipDuplicates: true,
    });
  }
  if (horariosYoga.length > 0) {
    await prisma.turno.createMany({
      data: [
        {
          fecha: new Date("2026-05-06T09:00:00Z"),
          estado: "confirmado",
          fechaCreacion: new Date("2026-05-01T11:00:00Z"),
          ID_HorarioClase: horariosYoga[0].ID_HorarioClase,
          ID_Usuario: alumno1.ID_Usuario,
        },
      ],
      skipDuplicates: true,
    });
  }
  console.log("✅  Turnos creados");

  // ─────────────────────────────────────────────
  // EJERCICIOS GENÉRICOS (catálogo)
  // ─────────────────────────────────────────────
  const ejerciciosData = [
    { nombre: "Sentadilla",           descripcion: "Movimiento básico de tren inferior.", musculos: "Cuádriceps, glúteos, isquiotibiales", equipamiento: "Barra / peso corporal", esGenerico: true },
    { nombre: "Press de banca",       descripcion: "Empuje horizontal con barra o mancuernas.", musculos: "Pecho, tríceps, hombros", equipamiento: "Banca + barra", esGenerico: true },
    { nombre: "Peso muerto",          descripcion: "Tracción desde el suelo, ejercicio compuesto.", musculos: "Cadena posterior, glúteos, espalda baja", equipamiento: "Barra", esGenerico: true },
    { nombre: "Dominadas",            descripcion: "Jalón vertical con peso corporal.", musculos: "Dorsal, bíceps, romboides", equipamiento: "Barra fija", esGenerico: true },
    { nombre: "Flexiones",            descripcion: "Empuje horizontal con peso corporal.", musculos: "Pecho, tríceps, hombros", equipamiento: "Ninguno", esGenerico: true },
    { nombre: "Press militar",        descripcion: "Empuje vertical sobre cabeza.", musculos: "Deltoides, tríceps, trapecio", equipamiento: "Barra / mancuernas", esGenerico: true },
    { nombre: "Remo con barra",       descripcion: "Tracción horizontal con barra.", musculos: "Dorsal, romboides, bíceps", equipamiento: "Barra", esGenerico: true },
    { nombre: "Zancadas",             descripcion: "Paso al frente con carga.", musculos: "Cuádriceps, glúteos, isquiotibiales", equipamiento: "Mancuernas / peso corporal", esGenerico: true },
    { nombre: "Hip thrust",           descripcion: "Empuje de cadera con barra.", musculos: "Glúteos, isquiotibiales", equipamiento: "Banca + barra", esGenerico: true },
    { nombre: "Curl de bíceps",       descripcion: "Flexión de codo con mancuernas o barra.", musculos: "Bíceps braquial", equipamiento: "Mancuernas / barra", esGenerico: true },
    { nombre: "Extensión de tríceps", descripcion: "Extensión de codo sobre cabeza.", musculos: "Tríceps", equipamiento: "Mancuerna / polea", esGenerico: true },
    { nombre: "Plancha",              descripcion: "Isometría de core en posición de empuje.", musculos: "Core, hombros", equipamiento: "Ninguno", esGenerico: true },
    { nombre: "Burpees",              descripcion: "Ejercicio metabólico de cuerpo completo.", musculos: "Cuerpo completo", equipamiento: "Ninguno", esGenerico: true },
    { nombre: "Box Jump",             descripcion: "Salto sobre cajón pliométrico.", musculos: "Piernas, glúteos", equipamiento: "Cajón pliométrico", esGenerico: true },
    { nombre: "Kettlebell swing",     descripcion: "Balanceo de pesa rusa con bisagra de cadera.", musculos: "Glúteos, cadena posterior, core", equipamiento: "Kettlebell", esGenerico: true },
  ];
  await prisma.ejercicio.createMany({ data: ejerciciosData, skipDuplicates: true });

  const ejercicios = await prisma.ejercicio.findMany({ where: { esGenerico: true } });
  const ejMap = Object.fromEntries(ejercicios.map(e => [e.nombre, e]));
  console.log("✅  Ejercicios genéricos creados");

  // ─────────────────────────────────────────────
  // RUTINAS
  // ─────────────────────────────────────────────

  // ── Rutina 1: Push/Pull/Legs para alumno1 (creada por entrenador1) ──
  const rutina1 = await prisma.rutina.create({
    data: {
      nombre: "Push / Pull / Legs",
      desc: "Rutina de 3 días enfocada en empuje, tracción y tren inferior.",
      claseRutina: "Fuerza",
      grupoMuscularRutina: "Cuerpo completo",
      ID_Usuario: alumno1.ID_Usuario,
      ID_Entrenador: entrenador1.ID_Usuario,
    },
  });

  // Días de rutina1
  const diaRutina1Push = await prisma.rutinaDia.create({
    data: { dia: "Lunes", nombre: "Push – Empuje", descripcion: "Pecho, hombros y tríceps", rutinaId: rutina1.ID_Rutina },
  });
  const diaRutina1Pull = await prisma.rutinaDia.create({
    data: { dia: "Miércoles", nombre: "Pull – Tracción", descripcion: "Espalda y bíceps", rutinaId: rutina1.ID_Rutina },
  });
  const diaRutina1Legs = await prisma.rutinaDia.create({
    data: { dia: "Viernes", nombre: "Legs – Tren inferior", descripcion: "Cuádriceps, glúteos e isquios", rutinaId: rutina1.ID_Rutina },
  });

  // Bloques de rutina1 – Push
  const bloquePush1 = await prisma.bloque.create({
    data: {
      type: BlockType.SETS_REPS,
      ID_Rutina: rutina1.ID_Rutina,
      rutinaDiaId: diaRutina1Push.id,
      setsReps: "4x8",
      nombreEj: "Press de banca",
      weight: "80 kg",
      descansoRonda: 90,
    },
  });
  if (ejMap["Press de banca"]) {
    await prisma.bloqueEjercicio.create({
      data: { ID_Bloque: bloquePush1.ID_Bloque, ID_Ejercicio: ejMap["Press de banca"].ID_Ejercicio, reps: "8", setRepWeight: "80 kg", orden: 1 },
    });
  }
  if (ejMap["Press militar"]) {
    await prisma.bloqueEjercicio.create({
      data: { ID_Bloque: bloquePush1.ID_Bloque, ID_Ejercicio: ejMap["Press militar"].ID_Ejercicio, reps: "10", setRepWeight: "50 kg", orden: 2 },
    });
  }

  const bloquePush2 = await prisma.bloque.create({
    data: {
      type: BlockType.SETS_REPS,
      ID_Rutina: rutina1.ID_Rutina,
      rutinaDiaId: diaRutina1Push.id,
      setsReps: "3x12",
      nombreEj: "Extensión de tríceps",
      weight: "20 kg",
      descansoRonda: 60,
    },
  });
  if (ejMap["Extensión de tríceps"]) {
    await prisma.bloqueEjercicio.create({
      data: { ID_Bloque: bloquePush2.ID_Bloque, ID_Ejercicio: ejMap["Extensión de tríceps"].ID_Ejercicio, reps: "12", orden: 1 },
    });
  }

  // Bloques de rutina1 – Pull
  const bloquePull1 = await prisma.bloque.create({
    data: {
      type: BlockType.SETS_REPS,
      ID_Rutina: rutina1.ID_Rutina,
      rutinaDiaId: diaRutina1Pull.id,
      setsReps: "4x6",
      nombreEj: "Peso muerto",
      weight: "120 kg",
      descansoRonda: 120,
    },
  });
  if (ejMap["Peso muerto"]) {
    await prisma.bloqueEjercicio.create({
      data: { ID_Bloque: bloquePull1.ID_Bloque, ID_Ejercicio: ejMap["Peso muerto"].ID_Ejercicio, reps: "6", setRepWeight: "120 kg", orden: 1 },
    });
  }

  const bloquePull2 = await prisma.bloque.create({
    data: {
      type: BlockType.SETS_REPS,
      ID_Rutina: rutina1.ID_Rutina,
      rutinaDiaId: diaRutina1Pull.id,
      setsReps: "3x8",
      nombreEj: "Remo con barra",
      weight: "70 kg",
      descansoRonda: 90,
    },
  });
  if (ejMap["Remo con barra"]) {
    await prisma.bloqueEjercicio.create({
      data: { ID_Bloque: bloquePull2.ID_Bloque, ID_Ejercicio: ejMap["Remo con barra"].ID_Ejercicio, reps: "8", setRepWeight: "70 kg", orden: 1 },
    });
  }
  if (ejMap["Dominadas"]) {
    await prisma.bloqueEjercicio.create({
      data: { ID_Bloque: bloquePull2.ID_Bloque, ID_Ejercicio: ejMap["Dominadas"].ID_Ejercicio, reps: "Max", orden: 2 },
    });
  }

  // Bloques de rutina1 – Legs
  const bloqueLegs1 = await prisma.bloque.create({
    data: {
      type: BlockType.SETS_REPS,
      ID_Rutina: rutina1.ID_Rutina,
      rutinaDiaId: diaRutina1Legs.id,
      setsReps: "4x10",
      nombreEj: "Sentadilla",
      weight: "100 kg",
      descansoRonda: 120,
    },
  });
  if (ejMap["Sentadilla"]) {
    await prisma.bloqueEjercicio.create({
      data: { ID_Bloque: bloqueLegs1.ID_Bloque, ID_Ejercicio: ejMap["Sentadilla"].ID_Ejercicio, reps: "10", setRepWeight: "100 kg", orden: 1 },
    });
  }
  if (ejMap["Zancadas"]) {
    await prisma.bloqueEjercicio.create({
      data: { ID_Bloque: bloqueLegs1.ID_Bloque, ID_Ejercicio: ejMap["Zancadas"].ID_Ejercicio, reps: "12", orden: 2 },
    });
  }
  if (ejMap["Hip thrust"]) {
    await prisma.bloqueEjercicio.create({
      data: { ID_Bloque: bloqueLegs1.ID_Bloque, ID_Ejercicio: ejMap["Hip thrust"].ID_Ejercicio, reps: "12", setRepWeight: "90 kg", orden: 3 },
    });
  }

  // ── Rutina 2: CrossFit AMRAP para alumno2 (creada por entrenador1) ──
  const rutina2 = await prisma.rutina.create({
    data: {
      nombre: "CrossFit Semanal",
      desc: "Rutina de CrossFit con bloques AMRAP y EMOM.",
      claseRutina: "CrossFit",
      grupoMuscularRutina: "Cuerpo completo",
      ID_Usuario: alumno2.ID_Usuario,
      ID_Entrenador: entrenador1.ID_Usuario,
    },
  });

  const diaRutina2A = await prisma.rutinaDia.create({
    data: { dia: "Lunes", nombre: "WOD A", rutinaId: rutina2.ID_Rutina },
  });
  const diaRutina2B = await prisma.rutinaDia.create({
    data: { dia: "Miércoles", nombre: "WOD B", rutinaId: rutina2.ID_Rutina },
  });

  // Bloque AMRAP
  const bloqueAMRAP = await prisma.bloque.create({
    data: {
      type: BlockType.AMRAP,
      ID_Rutina: rutina2.ID_Rutina,
      rutinaDiaId: diaRutina2A.id,
      durationMin: 12,
      nombreEj: "AMRAP 12 min",
    },
  });
  for (const [nombre, reps] of [["Burpees", "10"], ["Box Jump", "10"], ["Kettlebell swing", "15"]]) {
    if (ejMap[nombre]) {
      await prisma.bloqueEjercicio.create({
        data: { ID_Bloque: bloqueAMRAP.ID_Bloque, ID_Ejercicio: ejMap[nombre].ID_Ejercicio, reps, orden: Object.keys(ejMap).indexOf(nombre) + 1 },
      });
    }
  }

  // Bloque EMOM
  const bloqueEMOM = await prisma.bloque.create({
    data: {
      type: BlockType.EMOM,
      ID_Rutina: rutina2.ID_Rutina,
      rutinaDiaId: diaRutina2B.id,
      durationMin: 10,
      nombreEj: "EMOM 10 min",
    },
  });
  for (const [nombre, reps] of [["Flexiones", "10"], ["Sentadilla", "15"]]) {
    if (ejMap[nombre]) {
      await prisma.bloqueEjercicio.create({
        data: { ID_Bloque: bloqueEMOM.ID_Bloque, ID_Ejercicio: ejMap[nombre].ID_Ejercicio, reps, orden: 1 },
      });
    }
  }

  // ── Rutina 3: Full Body para alumno3 (creada por entrenador2) ──
  const rutina3 = await prisma.rutina.create({
    data: {
      nombre: "Full Body Principiante",
      desc: "Rutina completa para iniciarse en el entrenamiento con pesas.",
      claseRutina: "Fuerza",
      grupoMuscularRutina: "Cuerpo completo",
      ID_Usuario: alumno3.ID_Usuario,
      ID_Entrenador: entrenador2.ID_Usuario,
    },
  });

  const diaRutina3A = await prisma.rutinaDia.create({
    data: { dia: "Martes", nombre: "Día A – Cuerpo completo", rutinaId: rutina3.ID_Rutina },
  });
  const diaRutina3B = await prisma.rutinaDia.create({
    data: { dia: "Jueves", nombre: "Día B – Cuerpo completo", rutinaId: rutina3.ID_Rutina },
  });

  const bloqueFullA = await prisma.bloque.create({
    data: {
      type: BlockType.SETS_REPS,
      ID_Rutina: rutina3.ID_Rutina,
      rutinaDiaId: diaRutina3A.id,
      setsReps: "3x10",
      nombreEj: "Circuito básico",
      descansoRonda: 60,
    },
  });
  for (const [nombre, reps, orden] of [["Sentadilla", "10", 1], ["Flexiones", "10", 2], ["Plancha", "30s", 3], ["Zancadas", "10", 4]]) {
    if (ejMap[nombre]) {
      await prisma.bloqueEjercicio.create({
        data: { ID_Bloque: bloqueFullA.ID_Bloque, ID_Ejercicio: ejMap[nombre].ID_Ejercicio, reps, orden },
      });
    }
  }

  const bloqueFullB = await prisma.bloque.create({
    data: {
      type: BlockType.ROUNDS,
      ID_Rutina: rutina3.ID_Rutina,
      rutinaDiaId: diaRutina3B.id,
      cantRondas: 3,
      nombreEj: "Circuito tren superior",
      descansoRonda: 90,
    },
  });
  for (const [nombre, reps, orden] of [["Press militar", "10", 1], ["Remo con barra", "10", 2], ["Curl de bíceps", "12", 3]]) {
    if (ejMap[nombre]) {
      await prisma.bloqueEjercicio.create({
        data: { ID_Bloque: bloqueFullB.ID_Bloque, ID_Ejercicio: ejMap[nombre].ID_Ejercicio, reps, orden },
      });
    }
  }

  console.log("✅  Rutinas creadas");

  // ─────────────────────────────────────────────
  // MEDICIONES DE EJERCICIO (seguimiento personal)
  // ─────────────────────────────────────────────
  const medSentadillaAlumno1 = await prisma.ejercicioMedicion.create({
    data: { ID_Usuario: alumno1.ID_Usuario, nombre: "Sentadilla máximo", tipoMedicion: "kg" },
  });
  await prisma.historicoEjercicio.createMany({
    data: [
      { ID_EjercicioMedicion: medSentadillaAlumno1.ID_EjercicioMedicion, Fecha: new Date("2026-02-10"), Cantidad: 80 },
      { ID_EjercicioMedicion: medSentadillaAlumno1.ID_EjercicioMedicion, Fecha: new Date("2026-03-10"), Cantidad: 90 },
      { ID_EjercicioMedicion: medSentadillaAlumno1.ID_EjercicioMedicion, Fecha: new Date("2026-04-10"), Cantidad: 100 },
    ],
  });

  const medBancaAlumno1 = await prisma.ejercicioMedicion.create({
    data: { ID_Usuario: alumno1.ID_Usuario, nombre: "Press de banca máximo", tipoMedicion: "kg" },
  });
  await prisma.historicoEjercicio.createMany({
    data: [
      { ID_EjercicioMedicion: medBancaAlumno1.ID_EjercicioMedicion, Fecha: new Date("2026-02-15"), Cantidad: 60 },
      { ID_EjercicioMedicion: medBancaAlumno1.ID_EjercicioMedicion, Fecha: new Date("2026-03-15"), Cantidad: 70 },
      { ID_EjercicioMedicion: medBancaAlumno1.ID_EjercicioMedicion, Fecha: new Date("2026-04-15"), Cantidad: 80 },
    ],
  });

  const medBurpeesAlumno2 = await prisma.ejercicioMedicion.create({
    data: { ID_Usuario: alumno2.ID_Usuario, nombre: "Burpees en 1 minuto", tipoMedicion: "reps" },
  });
  await prisma.historicoEjercicio.createMany({
    data: [
      { ID_EjercicioMedicion: medBurpeesAlumno2.ID_EjercicioMedicion, Fecha: new Date("2026-03-01"), Cantidad: 18 },
      { ID_EjercicioMedicion: medBurpeesAlumno2.ID_EjercicioMedicion, Fecha: new Date("2026-04-01"), Cantidad: 22 },
      { ID_EjercicioMedicion: medBurpeesAlumno2.ID_EjercicioMedicion, Fecha: new Date("2026-05-01"), Cantidad: 25 },
    ],
  });

  const medFlexionesAlumno3 = await prisma.ejercicioMedicion.create({
    data: { ID_Usuario: alumno3.ID_Usuario, nombre: "Flexiones máximas seguidas", tipoMedicion: "reps" },
  });
  await prisma.historicoEjercicio.createMany({
    data: [
      { ID_EjercicioMedicion: medFlexionesAlumno3.ID_EjercicioMedicion, Fecha: new Date("2026-03-05"), Cantidad: 10 },
      { ID_EjercicioMedicion: medFlexionesAlumno3.ID_EjercicioMedicion, Fecha: new Date("2026-04-05"), Cantidad: 15 },
    ],
  });

  console.log("✅  Mediciones e histórico creados");

  // ─────────────────────────────────────────────
  // RESUMEN
  // ─────────────────────────────────────────────
  console.log("\n🎉  Seed completado. Credenciales de acceso:");
  console.log("┌─────────────────────────────────────────────────────────┐");
  console.log("│  ROL         │  EMAIL                  │  CONTRASEÑA    │");
  console.log("├─────────────────────────────────────────────────────────┤");
  console.log("│  Admin       │ admin@gymhour.com        │ Admin1234!     │");
  console.log("│  Entrenador  │ entrenador@gymhour.com   │ Entrenador1234!│");
  console.log("│  Entrenador  │ entrenador2@gymhour.com  │ Entrenador1234!│");
  console.log("│  Alumno      │ alumno1@gymhour.com      │ Alumno1234!    │");
  console.log("│  Alumno      │ alumno2@gymhour.com      │ Alumno1234!    │");
  console.log("│  Alumno      │ alumno3@gymhour.com      │ Alumno1234!    │");
  console.log("│  Alumno(*)   │ alumno4@gymhour.com      │ Alumno1234!    │");
  console.log("└─────────────────────────────────────────────────────────┘");
  console.log("(*) alumno4 tiene estado=false para probar cuenta inactiva");
}

main()
  .catch((e) => {
    console.error("❌  Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
