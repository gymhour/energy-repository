
# Jerarquia planes, cuotas, turnos y asistencias
  Plan
  Es la regla comercial.
  Define qué compró el alumno:

  - duración: mensual, trimestral, anual, etc.;
  - precio;
  - sesiones por semana;
  - sesiones de gracia;
  - si requiere turno o no.

  Ejemplo: Yoga 2 veces por semana, mensual, requiere turno.

  Cuota
  Es la compra concreta de ese plan por un alumno durante un período.

  Ejemplo:
  Pedro compró el plan Yoga 2 veces por semana para mayo.

  La cuota guarda:

  - alumno;
  - plan;
  - fecha de inicio y fin;
  - si está pagada;
  - reglas copiadas del plan en ese momento.

  Turno
  Es una reserva para una clase en una fecha y horario.

  Ejemplo:
  Pedro tiene turno de Yoga el martes 09:00.

  Un turno puede venir de:

  - turnos fijos generados automáticamente por la cuota;
  - reserva manual;
  - recuperación por una cancelación.

  Asistencia
  Es el ingreso real al gimnasio.

  Ejemplo:
  Pedro llegó el martes y marcó asistencia con DNI.

  Cuando marca asistencia:

  - el sistema busca su cuota activa;
  - valida si está pagada o tiene sesiones de gracia;
  - valida el límite semanal;
  - si el plan requiere turno, busca un turno activo ese día;
  - si todo está bien, crea la asistencia;
  - si había turno, lo marca como ASISTIDO.

  La relación simple sería:

  Plan
    define reglas

  Alumno + Plan
    generan una Cuota

  Cuota
    representa el período contratado
    puede generar Turnos

  Turnos
    reservan días y horarios

  Asistencia
    registra el ingreso real
    se vincula a la Cuota
    y opcionalmente a un Turno

  Ejemplo completo:

  Plan: Yoga 2x semana mensual
  Alumno: Pedro
  Cuota: Pedro paga mayo
  Turnos: martes 09:00 y jueves 09:00 durante mayo
  Asistencia: Pedro entra el martes, se registra ingreso y ese turno queda asistido

# Resumen y acciones - planes, cuotas, turnos y asistencias

Un plan puede requerir turnos como no.
Si requiere turnos
  - El alumno necesita tener un turno activo para poder ingresar.
  - Ese turno puede ser:
      - fijo, generado automáticamente por la cuota;
      - manual, reservado por el alumno;
      - recuperación, si canceló otro turno.
  - Al marcar asistencia, el sistema busca un turno activo válido.
  - Si lo encuentra:
      - permite el ingreso;
      - marca el turno como ASISTIDO;
      - vincula la asistencia con la cuota y el turno.
  - Si no lo encuentra:
      - deniega la asistencia.

Si no requiere turno:
  - El alumno puede marcar asistencia sin tener turno.
  - Igual se valida:
      - usuario activo;
      - cuota activa;
      - pago o sesiones de gracia;
      - límite semanal del plan.
  - Pero no se exige reserva previa.

Ejemplo:
  - Plan “Yoga 2 veces por semana” con requiereTurno = true: necesita turno martes/jueves o una recuperación.
  - Plan “Musculación libre 3 veces por semana” con requiereTurno = false: puede entrar directamente hasta 3 veces por semana sin reservar turno.

  En resumen: usaTurnosFijos pertenece al alumno y decide si se generan turnos automáticamente; requiereTurno pertenece al plan y decide si la asistencia necesita
  turno para permitir el ingreso.

Ejemplos de clientes:
Al momento de crear planes:
- Mauro y Wellness: deberian marcar todos sus planes con requierenTurno.
- Otros clientes: lo dejan des-marcado

Al momento de registrar un usuario:
- Mauro y Wellness: debe asignarle un plan y marcar el tilde "Usa turnos fijos" -> permite crear tantos turnos fijos como maxima sesiones del plan.
- Otros clientes: lo dejan des-marcado

Siguiendo el registro de clientes:
- Mauro y Wellness: deben crearle la cuota al cliente nuevo -> se generan todos los turnos del mes para ese usuario. Cuando entra a la cuenta, tiene todos los turnos.
- Otros clientes: pueden darle el acceso directamente. No van a tener ningun turno.

En el dia a dia del usuario - Mauro y Wellness: 
1. Si quieren cambiar un turno, deben cancelar un turno 1 hora antes del turno del dia y agendar el nuevo turno.
1.1. Si quieren cancelar el turno menos de 1 hora antes, no va a poder y se va a registrar la asistencia al turno por defecto
2. Si quieren asistir y marcar la asistencia al turno, lo deben hacer desde 1 hora antes del turno y hasta 15min despues
2.1. Si no ingresaron via dni/qr se marca asistido por defecto - pero sin asistencia presencial
3. Siempre van a tener que sacar turnos para cualquier actividad dentro del gimnasio y su limite seran la cantidad de sesiones semanales que tenga su plan

En el dia a dia del usuario - Otros clientes:
1. Pueden agendar turno como no - solo es una forma de organizacion para el gimnasio segun los cupos de una clase/actividad
2. Pueden marcar la asistencia una vez al dia (PREGUNTARSE SI PODRIAN HACERLO MAS VECES)

### Cuotas de gracia
Las sesiones de gracia son ingresos permitidos aunque la cuota todavía no esté pagada.

  Funcionan así:

  - Se configuran en el Plan.
  - Al crear la cuota, la cuota guarda una copia de ese valor.
  - Si la cuota está impaga, el sistema permite hasta esa cantidad de asistencias.
  - Cuando se consumen, el sistema bloquea nuevas asistencias hasta que la cuota se marque como pagada.
  - Cuando la cuota se paga, el alumno vuelve a usar el plan normalmente.

  Ejemplo:

  Plan:

  - Sesiones por semana: 2
  - Sesiones de gracia: 2
  - Requiere turno: true

  Alumno con cuota impaga:

  - Primera asistencia válida: permitida.
  - Segunda asistencia válida: permitida.
  - Tercera asistencia con cuota impaga: denegada.
  - Si el admin marca la cuota como pagada: vuelve a poder asistir según las reglas normales del plan.

  Importante:

  - Si el plan requiere turno, la sesión de gracia igual necesita turno válido.
  - Si el plan no requiere turno, puede usar la gracia sin turno.
  - Las sesiones de gracia no son “extra”; son una tolerancia temporal antes del pago.
  - El conteo de gracia es por cuota/período, no por semana.


# Como testear todo esto

### Turnos fijos
1. Crear plan con:
      - Duración: Mensual
      - Sesiones por semana: 2
      - Sesiones de gracia: 2
      - Requiere turno: activado
      - Precio: cualquiera

2. Crear alumno con turnos fijos:
  - Tipo: Cliente.
  - Asignar el plan.
  - Activar Usa turnos fijos.
  - Agregar, por ejemplo:
      - Yoga martes 09:00
      - Yoga jueves 09:00
  - Crear usuario.

3. Crear cuota:
  - Crear cuota para ese alumno.
  - Resultado esperado:
      - La cuota aparece inmediatamente en la tabla.
      - Se generan los turnos fijos del período.

4. Revisar turnos:
  - Entrar como alumno o revisar desde Admin > Turnos.
  - Resultado esperado:
      - Los turnos generados figuran como próximos si todavía no pasaron.

5. Probar asistencia:
  - Ir al check-in/asistencia.
  - Ingresar el DNI del alumno.
  - Para desarrollo, la ventana de asistencia dura todo el día.
  - Resultado esperado:
      - Si el alumno tiene turno activo ese día, se permite la asistencia.
      - El turno queda marcado como ASISTIDO.
      - La asistencia queda vinculada al turno y a la cuota.

6. Probar asistencia sin turno:
  - Intentar marcar asistencia un día donde el alumno no tiene turno.
  - Resultado esperado:
      - Acceso denegado por no tener turno activo para ese día.

7. Probar límite semanal:
  - Con plan de 2 sesiones por semana, intentar reservar un tercer turno manual en la misma semana.
  - Resultado esperado:
      - El sistema rechaza la reserva por límite semanal.

8. Probar cancelación válida:
  - Cancelar un turno con más de 1 hora de anticipación.
  - Resultado esperado:
      - El turno pasa a CANCELADO.
      - Ya no aparece como próximo.
      - Se libera cupo semanal para reservar otro turno esa misma semana.

9. Probar cancelación tardía:
  - Intentar cancelar un turno que empieza en menos de 1 hora.
  - Resultado esperado:
      - El sistema rechaza la cancelación.

10. Probar recuperación:
  - Cancelar un turno válido.
  - Reservar otro turno en la misma semana.
  - Resultado esperado:
      - La reserva se permite si hay cupo de clase.
      - Sigue respetando el máximo de sesiones semanales.

11. Probar sesiones de gracia:
  - Crear cuota impaga con sesionesGracia = 2.
  - Marcar asistencia en días con turno.
  - Resultado esperado:
      - Las primeras 2 asistencias se permiten aunque la cuota esté impaga.
      - La tercera se deniega hasta pagar la cuota.
  - Marcar cuota como pagada.
  - Resultado esperado:
      - Se habilita el uso normal restante.

12. Probar edición de usuario:
  - Activar/desactivar Usa turnos fijos.
  - Agregar o quitar horarios fijos.
  - Resultado esperado:
      - Los cambios quedan persistidos.
      - Nuevas cuotas futuras usan la nueva plantilla de turnos fijos.

# Comentario sobre los snapshots de Cuotas.

"Capturan" la información del plan en el momento que se creo la cuota. Sirve para que una cuota no cambie sus reglas si se edita el plan.

Ejemplo:
  1. Plan:
      - Nombre: Yoga 2x semana
      - Duración: Mensual
      - Sesiones por semana: 2
      - Sesiones de gracia: 2
      - Requiere turno: true
  2. Generás una cuota para Pedro en mayo.
  3. Después editás el plan:
      - Sesiones por semana: 3
      - Precio distinto
      - Sesiones de gracia: 0

Sin snapshot, la cuota de mayo de Pedro pasaría a comportarse con las reglas nuevas, aunque fue vendida con las reglas viejas.

Con snapshot, la cuota guarda:
  planNombreSnapshot
  planDuracionSnapshot
  planSesionesSemanaSnapshot
  planSesionesGraciaSnapshot
  planRequiereTurnoSnapshot

Entonces esa cuota conserva las condiciones contratadas al momento de generarse.

En resumen:
  - Plan = configuración actual del producto.
  - Cuota = contrato/período comprado por el alumno.
  - Snapshot = copia de las reglas del plan al momento de crear esa cuota.

Esto evita bugs en históricos, pagos, asistencias y renovaciones.
