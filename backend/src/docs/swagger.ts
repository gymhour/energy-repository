export const swaggerDocument = {
  "openapi": "3.0.0",
  "info": {
    "title": "API de Gym",
    "version": "1.0.0",
    "description": "Documentación de la API del gimnasio"
  },
  "servers": [
    {
      "url": "https://gymbackend-qr97.onrender.com",
      "description": "Servidor en la nube"
    },
    {
      "url": "http://localhost:3000",
      "description": "Servidor local"
    }
  ],
  "paths": {
    "/auth/register": {
      "post": {
        "tags": ["Auth"],
        "summary": "Registrar un nuevo usuario",
        "description": "Permite registrar un nuevo usuario en el sistema.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "email": {
                    "type": "string",
                    "example": "usuario@ejemplo.com",
                    "description": "El correo electrónico del usuario."
                  },
                  "password": {
                    "type": "string",
                    "example": "contraseñaSegura123",
                    "description": "La contraseña del usuario."
                  },
                  "tipo": {
                    "type": "string",
                    "example": "cliente",
                    "description": "El tipo de usuario, por ejemplo, 'cliente' o 'admin'."
                  }
                },
                "required": ["email", "password"]
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Usuario registrado con éxito.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "token": {
                      "type": "string",
                      "example": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Error en la solicitud, por ejemplo, email ya existe o datos faltantes."
          },
          "500": {
            "description": "Error interno del servidor."
          }
        }
      }
    },
    "/auth/login": {
      "post": {
        "tags": ["Auth"],
        "summary": "Iniciar sesión",
        "description": "Permite iniciar sesión a un usuario registrado.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "email": {
                    "type": "string",
                    "example": "usuario@ejemplo.com",
                    "description": "El correo electrónico del usuario."
                  },
                  "password": {
                    "type": "string",
                    "example": "contraseñaSegura123",
                    "description": "La contraseña del usuario."
                  }
                },
                "required": ["email", "password"]
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Inicio de sesión exitoso.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "token": {
                      "type": "string",
                      "example": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Datos faltantes en la solicitud."
          },
          "404": {
            "description": "El usuario no fue encontrado."
          },
          "401": {
            "description": "Contraseña incorrecta."
          },
          "500": {
            "description": "Error interno del servidor."
          }
        }
      }
    },
    "/usuarios": {
      "get": {
        "summary": "Obtener todos los usuarios",
        "tags": ["Usuarios"],
        "security": [{ "bearerAuth": [] }],
        "responses": {
          "200": {
            "description": "Lista de usuarios",
            "content": {
              "application/json": {
                "example": [
                  { "ID_Usuario": 1, "email": "user1@example.com" },
                  { "ID_Usuario": 2, "email": "user2@example.com" }
                ]
              }
            }
          },
          "500": {
            "description": "Error interno"
          }
        }
      },
      "post": {
        "summary": "Crear un nuevo usuario",
        "tags": ["Usuarios"],
        "security": [{ "bearerAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "example": {
                "email": "nuevo_usuario@example.com",
                "password": "password123"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Usuario creado",
            "content": {
              "application/json": {
                "example": { "ID_Usuario": 1, "email": "nuevo_usuario@example.com" }
              }
            }
          },
          "400": {
            "description": "Solicitud inválida"
          },
          "500": {
            "description": "Error interno"
          }
        }
      }
    },
    "/usuarios/{id}": {
      "get": {
        "summary": "Obtener un usuario por ID",
        "tags": ["Usuarios"],
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer"
            },
            "description": "ID del usuario"
          }
        ],
        "responses": {
          "200": {
            "description": "Usuario encontrado",
            "content": {
              "application/json": {
                "example": { "ID_Usuario": 1, "email": "usuario@example.com" }
              }
            }
          },
          "404": {
            "description": "Usuario no encontrado"
          },
          "500": {
            "description": "Error interno"
          }
        }
      },
      "put": {
        "summary": "Actualizar un usuario",
        "tags": ["Usuarios"],
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer"
            },
            "description": "ID del usuario"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "example": {
                "email": "actualizado@example.com",
                "password": "nuevo_password123"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Usuario actualizado",
            "content": {
              "application/json": {
                "example": { "ID_Usuario": 1, "email": "actualizado@example.com" }
              }
            }
          },
          "400": {
            "description": "Solicitud inválida"
          },
          "404": {
            "description": "Usuario no encontrado"
          },
          "500": {
            "description": "Error interno"
          }
        }
      },
      "delete": {
        "summary": "Eliminar un usuario",
        "tags": ["Usuarios"],
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer"
            },
            "description": "ID del usuario"
          }
        ],
        "responses": {
          "200": {
            "description": "Usuario eliminado",
            "content": {
              "application/json": {
                "example": { "message": "El usuario 1 ha sido eliminado" }
              }
            }
          },
          "404": {
            "description": "Usuario no encontrado"
          },
          "500": {
            "description": "Error interno"
          }
        }
      }
    },
    "/usuarios/asistencias/registrar": {
      "post": {
        "tags": ["Asistencias"],
        "summary": "Registrar el ingreso/asistencia de un alumno por DNI",
        "description": "Permite registrar una entrada ingresando el DNI. Evalúa estado activo y cuota paga del mes en curso.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "dni": {
                    "type": "string",
                    "example": "38450123",
                    "description": "DNI del alumno"
                  }
                },
                "required": ["dni"]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Evaluación de acceso realizada.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "permitido": {
                      "type": "boolean",
                      "example": true
                    },
                    "resultado": {
                      "type": "string",
                      "example": "PERMITIDO"
                    },
                    "motivo": {
                      "type": "string",
                      "example": "Acceso autorizado. Cuota al día."
                    },
                    "alumno": {
                      "type": "object",
                      "properties": {
                        "nombre": { "type": "string", "example": "Valen" },
                        "apellido": { "type": "string", "example": "Casesi" }
                      }
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Faltan datos requeridos (DNI)."
          },
          "500": {
            "description": "Error interno al procesar el ingreso."
          }
        }
      }
    },
    "/usuarios/asistencias/historial": {
      "get": {
        "tags": ["Asistencias"],
        "summary": "Consultar historial de asistencias (Solo Admins/Entrenadores)",
        "description": "Devuelve los logs de ingresos ordenados por fecha descendente, con filtros de búsqueda opcionales.",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          {
            "name": "dni",
            "in": "query",
            "schema": { "type": "string" },
            "description": "Filtrar por DNI del alumno"
          },
          {
            "name": "fechaInicio",
            "in": "query",
            "schema": { "type": "string", "format": "date-time" },
            "description": "Filtrar ingresos a partir de esta fecha"
          },
          {
            "name": "fechaFin",
            "in": "query",
            "schema": { "type": "string", "format": "date-time" },
            "description": "Filtrar ingresos hasta esta fecha"
          },
          {
            "name": "permitido",
            "in": "query",
            "schema": { "type": "boolean" },
            "description": "Filtrar por accesos permitidos (true) o denegados (false)"
          },
          {
            "name": "limit",
            "in": "query",
            "schema": { "type": "integer", "default": 20 },
            "description": "Cantidad de registros por página"
          },
          {
            "name": "page",
            "in": "query",
            "schema": { "type": "integer", "default": 1 },
            "description": "Número de página"
          }
        ],
        "responses": {
          "200": {
            "description": "Historial recuperado exitosamente.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "data": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "ID_Asistencia": { "type": "integer", "example": 10 },
                          "fechaIngreso": { "type": "string", "format": "date-time" },
                          "metodo": { "type": "string", "example": "DNI" },
                          "permitido": { "type": "boolean", "example": true },
                          "resultado": { "type": "string", "example": "PERMITIDO" },
                          "motivo": { "type": "string", "example": "Acceso autorizado. Cuota al día." },
                          "User": {
                            "type": "object",
                            "properties": {
                              "nombre": { "type": "string", "example": "Juan" },
                              "apellido": { "type": "string", "example": "Pérez" },
                              "dni": { "type": "string", "example": "123456" }
                            }
                          }
                        }
                      }
                    },
                    "pagination": {
                      "type": "object",
                      "properties": {
                        "total": { "type": "integer", "example": 1 },
                        "pages": { "type": "integer", "example": 1 },
                        "page": { "type": "integer", "example": 1 },
                        "limit": { "type": "integer", "example": 20 }
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "Token inválido o ausente."
          },
          "403": {
            "description": "Rol insuficiente para consultar historial."
          },
          "500": {
            "description": "Error interno del servidor."
          }
        }
      }
    },
    "/clase/horario": {
      "get": {
        "summary": "Obtener todas las clases con horarios",
        "tags": ["Clases"],
        "responses": {
          "200": {
            "description": "Lista de clases con horarios",
            "content": {
              "application/json": {
                "example": [
                  {
                    "ID_Clase": 1,
                    "nombre": "Clase 1",
                    "HorariosClase": [
                      { "diaSemana": "Lunes", "horaIni": "08:00", "horaFin": "09:00" }
                    ]
                  }
                ]
              }
            }
          },
          "500": {
            "description": "Error interno"
          }
        }
      },
      "post": {
        "summary": "Crear una nueva clase con horarios",
        "tags": ["Clases"],
        "requestBody": {
          "required": true,
          "content": {
            "multipart/form-data": {
              "example": {
                "nombre": "Nueva Clase",
                "descripcion": "Descripción de la clase",
                "horarios": [
                  { "diaSemana": "Martes", "horaIni": "10:00", "horaFin": "11:00", "cupos": 30 }
                ],
                "image": "(archivo imagen)"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Clase creada"
          },
          "400": {
            "description": "Solicitud inválida"
          },
          "500": {
            "description": "Error interno"
          }
        }
      },
      "put": {
        "summary": "Actualizar una clase",
        "tags": ["Clases"],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer"
            },
            "description": "ID de la clase"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "example": {
                "nombre": "Clase actualizada",
                "descripcion": "Descripción actualizada de la clase",
                "horarios": [
                  { "diaSemana": "Miércoles", "horaIni": "12:00", "horaFin": "13:00", "cupos": 25 }
                ]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Clase actualizada"
          },
          "400": {
            "description": "Solicitud inválida"
          }
        }
      }
    },
    "/turnos": {
      "get": {
        "tags": ["Turnos"],
        "summary": "Obtener todos los turnos",
        "description": "Devuelve una lista de todos los turnos con información adicional del usuario y la clase.",
        "responses": {
          "200": {
            "description": "Lista de turnos obtenida exitosamente.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Turno"
                  }
                }
              }
            }
          },
          "500": {
            "description": "Error interno al obtener los turnos."
          }
        }
      },
      "post": {
        "tags": ["Turnos"],
        "summary": "Crear un nuevo turno",
        "description": "Crea un turno para un usuario en un horario específico.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/TurnoInput"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Turno creado exitosamente."
          },
          "400": {
            "description": "Datos faltantes o cupos no disponibles."
          },
          "500": {
            "description": "Error interno al crear el turno."
          }
        }
      }
    },
    "/turnos/{id}": {
      "get": {
        "tags": ["Turnos"],
        "summary": "Obtener un turno por ID",
        "description": "Devuelve los detalles de un turno específico por su ID.",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer"
            },
            "description": "ID del turno a obtener."
          }
        ],
        "responses": {
          "200": {
            "description": "Detalles del turno obtenidos exitosamente."
          },
          "404": {
            "description": "Turno no encontrado."
          },
          "500": {
            "description": "Error interno al obtener el turno."
          }
        }
      },
      "put": {
        "tags": ["Turnos"],
        "summary": "Actualizar un turno por ID",
        "description": "Actualiza los detalles de un turno específico por su ID.",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer"
            },
            "description": "ID del turno a actualizar."
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/TurnoInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Turno actualizado exitosamente."
          },
          "400": {
            "description": "Cupos no disponibles o datos incorrectos."
          },
          "404": {
            "description": "Turno no encontrado."
          },
          "500": {
            "description": "Error interno al actualizar el turno."
          }
        }
      },
      "delete": {
        "tags": ["Turnos"],
        "summary": "Eliminar un turno por ID",
        "description": "Elimina un turno específico por su ID.",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer"
            },
            "description": "ID del turno a eliminar."
          }
        ],
        "responses": {
          "200": {
            "description": "Turno eliminado exitosamente."
          }
        }
      }
    },
    "/admin/dashboard": {
      "get": {
        "tags": ["Admin Dashboard"],
        "summary": "Obtener estadísticas generales del panel de administración",
        "description": "Retorna métricas operativas tales como ganancias del mes, alumnos activos, cuotas y distribución por planes.",
        "security": [{ "bearerAuth": [] }],
        "responses": {
          "200": {
            "description": "Estadísticas obtenidas exitosamente.",
            "content": {
              "application/json": {
                "example": {
                  "gananciasMesActual": 120500,
                  "totalUsuariosActivos": 45,
                  "cuotasDelMes": {
                    "total": 50,
                    "pagadas": 40,
                    "pendientes": 10
                  },
                  "usuariosPorPlan": [
                    { "plan": "Pase Libre", "cantidad": 25 },
                    { "plan": "3 Veces por Semana", "cantidad": 20 }
                  ]
                }
              }
            }
          },
          "401": { "description": "Token inválido o ausente." },
          "403": { "description": "Acceso denegado. Se requieren permisos de Admin." },
          "500": { "description": "Error interno del servidor." }
        }
      }
    },
    "/planes": {
      "get": {
        "tags": ["Planes"],
        "summary": "Obtener todos los planes de membresía",
        "security": [{ "bearerAuth": [] }],
        "responses": {
          "200": {
            "description": "Lista de planes",
            "content": {
              "application/json": {
                "example": [
                  { "ID_Plan": 1, "nombre": "Pase Libre", "desc": "Acceso ilimitado", "precio": 15000 },
                  { "ID_Plan": 2, "nombre": "Pase Comun", "desc": "3 veces por semana", "precio": 11000 }
                ]
              }
            }
          },
          "401": { "description": "No autorizado." }
        }
      },
      "post": {
        "tags": ["Planes"],
        "summary": "Crear un nuevo plan de membresía (Solo Admin)",
        "security": [{ "bearerAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "nombre": { "type": "string", "example": "Pase Premium" },
                  "desc": { "type": "string", "example": "Acceso ilimitado y pase a pileta" },
                  "precio": { "type": "number", "example": 22000 }
                },
                "required": ["nombre", "precio"]
              }
            }
          }
        },
        "responses": {
          "201": { "description": "Plan creado con éxito." },
          "400": { "description": "Datos incorrectos." }
        }
      }
    },
    "/planes/{id}": {
      "get": {
        "tags": ["Planes"],
        "summary": "Obtener un plan de membresía por ID",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Plan encontrado." },
          "404": { "description": "Plan no encontrado." }
        }
      },
      "put": {
        "tags": ["Planes"],
        "summary": "Actualizar un plan de membresía por ID (Solo Admin)",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "nombre": { "type": "string", "example": "Pase Premium Modificado" },
                  "desc": { "type": "string" },
                  "precio": { "type": "number" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Plan actualizado." },
          "404": { "description": "Plan no encontrado." }
        }
      },
      "delete": {
        "tags": ["Planes"],
        "summary": "Eliminar un plan de membresía por ID (Solo Admin)",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Plan eliminado." },
          "404": { "description": "Plan no encontrado." }
        }
      }
    },
    "/planes/usuario/{idUsuario}": {
      "get": {
        "tags": ["Planes"],
        "summary": "Obtener el plan de membresía asignado a un usuario",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "idUsuario", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Plan obtenido con éxito." },
          "404": { "description": "Usuario no encontrado o no tiene plan." }
        }
      }
    },
    "/cuotas": {
      "get": {
        "tags": ["Cuotas"],
        "summary": "Obtener todas las cuotas del sistema (Solo Admin)",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "schema": { "type": "integer", "default": 1 },
            "description": "Número de página para paginación (15 cuotas por página)"
          },
          {
            "name": "email",
            "in": "query",
            "schema": { "type": "string" },
            "description": "Filtrar por email del alumno"
          },
          {
            "name": "dni",
            "in": "query",
            "schema": { "type": "string" },
            "description": "Filtrar por DNI del alumno"
          },
          {
            "name": "estado",
            "in": "query",
            "schema": { "type": "string" },
            "description": "Filtrar por estado ('pagada', 'pendiente', o 'false')"
          },
          {
            "name": "mes",
            "in": "query",
            "schema": { "type": "string" },
            "description": "Filtrar por mes de la cuota (formato YYYY-MM)"
          },
          {
            "name": "plan",
            "in": "query",
            "schema": { "type": "string" },
            "description": "Filtrar por nombre del plan"
          },
          {
            "name": "vencida",
            "in": "query",
            "schema": { "type": "boolean" },
            "description": "Filtrar explícitamente por si la cuota está vencida (true o false)"
          }
        ],
        "responses": {
          "200": {
            "description": "Lista global de cuotas.",
            "content": {
              "application/json": {
                "example": [
                  { "ID_Cuota": 1, "mes": "2026-05", "importe": 15000, "vence": "2026-05-10T00:00:00Z", "pagada": true, "ID_Usuario": 2 }
                ]
              }
            }
          }
        }
      }
    },
    "/cuotas/usuario/{idUsuario}": {
      "post": {
        "tags": ["Cuotas"],
        "summary": "Crear cuota manualmente para un alumno (Solo Admin)",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "idUsuario", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "mes": { "type": "string", "example": "2026-05", "description": "Formato YYYY-MM" },
                  "importe": { "type": "number", "example": 15000 },
                  "vence": { "type": "string", "format": "date-time", "example": "2026-05-10T00:00:00Z" }
                },
                "required": ["mes", "importe", "vence"]
              }
            }
          }
        },
        "responses": {
          "201": { "description": "Cuota creada manualmente." }
        }
      }
    },
    "/cuotas/usuario/{idUsuario}/cuotas": {
      "get": {
        "tags": ["Cuotas"],
        "summary": "Obtener todas las cuotas de un alumno",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "idUsuario", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Lista de cuotas del usuario obtenida." }
        }
      }
    },
    "/cuotas/reminder/{idUsuario}": {
      "get": {
        "tags": ["Cuotas"],
        "summary": "Obtener recordatorio de cuotas por vencer en los próximos 3 días",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "idUsuario", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": {
            "description": "Recordatorio de cuota.",
            "content": {
              "application/json": {
                "example": {
                  "venceHoy": 0,
                  "porVencer": 1,
                  "detalles": [
                    { "mes": "2026-05", "importe": 15000, "vence": "2026-05-22T00:00:00Z", "estado": "Vence en 3 día(s)" }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/cuotas/generate-cuotas": {
      "post": {
        "tags": ["Cuotas"],
        "summary": "Generar de forma masiva las cuotas de todos los alumnos activos (Solo Admin)",
        "security": [{ "bearerAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "mes": { "type": "string", "example": "2026-06", "description": "Formato YYYY-MM" },
                  "vence": { "type": "string", "format": "date-time", "example": "2026-06-10T00:00:00Z" }
                },
                "required": ["mes", "vence"]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Cuotas mensuales generadas con éxito."
          }
        }
      }
    },
    "/cuotas/{id}": {
      "put": {
        "tags": ["Cuotas"],
        "summary": "Actualizar el importe de una cuota pendiente o vencida (Solo Admin)",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["importe"],
                "properties": {
                  "importe": { "type": "number", "example": 16000, "minimum": 0.01 }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Importe de cuota actualizado exitosamente." },
          "400": { "description": "ID o importe inválido." },
          "404": { "description": "Cuota no encontrada." },
          "409": { "description": "La cuota está pagada y no se puede editar." }
        }
      },
      "delete": {
        "tags": ["Cuotas"],
        "summary": "Eliminar una cuota por ID (Solo Admin)",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Cuota eliminada." }
        }
      }
    },
    "/cuotas/{id}/pay": {
      "put": {
        "tags": ["Cuotas"],
        "summary": "Registrar el pago de una cuota específica (Solo Admin)",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "formaPago": { "type": "string", "example": "MERCADOPAGO" }
                },
                "required": ["formaPago"]
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Pago registrado con éxito y cuota marcada como pagada." }
        }
      }
    },
    "/ejercicios": {
      "get": {
        "tags": ["Ejercicios"],
        "summary": "Obtener todos los ejercicios del catálogo maestro",
        "security": [{ "bearerAuth": [] }],
        "responses": {
          "200": { "description": "Catálogo de ejercicios obtenido." }
        }
      },
      "post": {
        "tags": ["Ejercicios"],
        "summary": "Crear un nuevo ejercicio en el catálogo maestro (Soporta archivo de imagen)",
        "security": [{ "bearerAuth": [] }],
        "description": "Registra un ejercicio con carga de archivo multipart para la imagen.",
        "requestBody": {
          "required": true,
          "content": {
            "multipart/form-data": {
              "schema": {
                "type": "object",
                "properties": {
                  "nombre": { "type": "string", "example": "Prensa de Piernas" },
                  "descripcion": { "type": "string", "example": "Empuje de piernas en máquina de 45 grados." },
                  "youtubeUrl": { "type": "string", "example": "https://youtube.com/..." },
                  "instrucciones": { "type": "string", "example": "Colocar pies al ancho de hombros, descender controladamente..." },
                  "esGenerico": { "type": "boolean", "example": false },
                  "musculos": { "type": "string", "example": "Cuádriceps, Femorales" },
                  "equipamiento": { "type": "string", "example": "Prensa de 45 grados" },
                  "imagen": { "type": "string", "format": "binary", "description": "Archivo de imagen" }
                },
                "required": ["nombre"]
              }
            }
          }
        },
        "responses": {
          "201": { "description": "Ejercicio maestro creado." }
        }
      }
    },
    "/ejercicios/{id}": {
      "get": {
        "tags": ["Ejercicios"],
        "summary": "Obtener un ejercicio del catálogo maestro por su ID",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Ejercicio recuperado." },
          "404": { "description": "Ejercicio no encontrado." }
        }
      },
      "put": {
        "tags": ["Ejercicios"],
        "summary": "Actualizar un ejercicio por ID (Soporta archivo de imagen)",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "multipart/form-data": {
              "schema": {
                "type": "object",
                "properties": {
                  "nombre": { "type": "string" },
                  "descripcion": { "type": "string" },
                  "youtubeUrl": { "type": "string" },
                  "instrucciones": { "type": "string" },
                  "esGenerico": { "type": "boolean" },
                  "musculos": { "type": "string" },
                  "equipamiento": { "type": "string" },
                  "imagen": { "type": "string", "format": "binary" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Ejercicio actualizado." }
        }
      },
      "delete": {
        "tags": ["Ejercicios"],
        "summary": "Eliminar un ejercicio del catálogo maestro por su ID",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Ejercicio eliminado exitosamente." }
        }
      }
    },
    "/ejercicios-resultados": {
      "get": {
        "tags": ["Ejercicios Medicion"],
        "summary": "Obtener todas las métricas de medición registradas",
        "security": [{ "bearerAuth": [] }],
        "responses": {
          "200": { "description": "Lista de métricas obtenida." }
        }
      },
      "post": {
        "tags": ["Ejercicios Medicion"],
        "summary": "Crear una nueva métrica de medición para un alumno",
        "security": [{ "bearerAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "ID_Usuario": { "type": "integer", "example": 1 },
                  "nombre": { "type": "string", "example": "Porcentaje Graso" },
                  "tipoMedicion": { "type": "string", "example": "Porcentaje (%)" }
                },
                "required": ["ID_Usuario", "nombre", "tipoMedicion"]
              }
            }
          }
        },
        "responses": {
          "201": { "description": "Métrica de medición creada." }
        }
      }
    },
    "/ejercicios-resultados/{id}": {
      "get": {
        "tags": ["Ejercicios Medicion"],
        "summary": "Obtener una métrica de medición por su ID",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Métrica recuperada." }
        }
      },
      "put": {
        "tags": ["Ejercicios Medicion"],
        "summary": "Actualizar datos generales de una métrica de medición",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "nombre": { "type": "string", "example": "Porcentaje de Grasa Corporal" },
                  "tipoMedicion": { "type": "string", "example": "Porcentaje (%)" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Métrica de medición actualizada." }
        }
      },
      "delete": {
        "tags": ["Ejercicios Medicion"],
        "summary": "Eliminar una métrica de medición por ID",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Métrica de medición eliminada de forma exitosa." }
        }
      }
    },
    "/ejercicios-resultados/usuario/{idUsuario}": {
      "get": {
        "tags": ["Ejercicios Medicion"],
        "summary": "Obtener todos los ejercicios de medición asociados a un alumno específico",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "idUsuario", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Métricas del alumno recuperadas exitosamente." }
        }
      }
    },
    "/ejercicios-resultados/max/{id}": {
      "get": {
        "tags": ["Ejercicios Medicion"],
        "summary": "Obtener la mejor marca/récord histórico registrado para una métrica",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": {
            "description": "Récord obtenido con éxito.",
            "content": {
              "application/json": {
                "example": {
                  "maxCantidad": 95
                }
              }
            }
          }
        }
      }
    },
    "/historicoEjercicio": {
      "post": {
        "tags": ["Historial Medicion"],
        "summary": "Registrar un nuevo valor de marca en el histórico de una métrica",
        "security": [{ "bearerAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "Cantidad": { "type": "integer", "example": 14, "description": "El valor registrado" },
                  "ID_EjercicioMedicion": { "type": "integer", "example": 2, "description": "ID de la métrica de medición" }
                },
                "required": ["Cantidad", "ID_EjercicioMedicion"]
              }
            }
          }
        },
        "responses": {
          "201": { "description": "Marca histórica agregada correctamente." }
        }
      }
    },
    "/historicoEjercicio/{id}": {
      "get": {
        "tags": ["Historial Medicion"],
        "summary": "Obtener un registro histórico de marca por ID",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Registro histórico recuperado." }
        }
      },
      "put": {
        "tags": ["Historial Medicion"],
        "summary": "Modificar el valor de una marca histórica por ID",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "Cantidad": { "type": "integer", "example": 16 },
                  "ID_EjercicioMedicion": { "type": "integer", "example": 2 }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Registro histórico actualizado." }
        }
      },
      "delete": {
        "tags": ["Historial Medicion"],
        "summary": "Eliminar un registro del historial por ID",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Registro del histórico eliminado." }
        }
      }
    },
    "/rutinas": {
      "get": {
        "tags": ["Rutinas"],
        "summary": "Obtener todas las rutinas registradas",
        "security": [{ "bearerAuth": [] }],
        "responses": {
          "200": { "description": "Lista de rutinas obtenida." }
        }
      },
      "post": {
        "tags": ["Rutinas"],
        "summary": "Crear una nueva rutina con soporte para bloques anidados",
        "security": [{ "bearerAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "nombre": { "type": "string", "example": "Rutina A - Piernas" },
                  "desc": { "type": "string", "example": "Enfoque en cuádriceps e isquiotibiales." },
                  "claseRutina": { "type": "string", "example": "Musculación" },
                  "grupoMuscularRutina": { "type": "string", "example": "Tren Inferior" },
                  "ID_Usuario": { "type": "integer", "example": 1 },
                  "ID_Entrenador": { "type": "integer", "example": 2 }
                },
                "required": ["nombre", "ID_Usuario"]
              }
            }
          }
        },
        "responses": {
          "201": { "description": "Rutina creada exitosamente." }
        }
      }
    },
    "/rutinas/{id}": {
      "get": {
        "tags": ["Rutinas"],
        "summary": "Obtener el detalle estructurado de una rutina por su ID",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Rutina recuperada exitosamente con sus bloques y ejercicios." }
        }
      },
      "put": {
        "tags": ["Rutinas"],
        "summary": "Actualizar una rutina y su estructura por su ID",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "nombre": { "type": "string", "example": "Rutina Piernas Modificada" },
                  "desc": { "type": "string" },
                  "claseRutina": { "type": "string" },
                  "grupoMuscularRutina": { "type": "string" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Rutina modificada exitosamente." }
        }
      },
      "delete": {
        "tags": ["Rutinas"],
        "summary": "Eliminar una rutina y toda su estructura anidada en cascada",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Rutina y elementos secundarios eliminados en cascada de forma exitosa." }
        }
      }
    },
    "/rutinas/entrenador/{idEntrenador}": {
      "get": {
        "tags": ["Rutinas"],
        "summary": "Obtener las rutinas diseñadas por un entrenador",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "idEntrenador", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Rutinas del entrenador obtenidas con éxito." }
        }
      }
    },
    "/rutinas/usuario/{idUsuario}": {
      "get": {
        "tags": ["Rutinas"],
        "summary": "Obtener las rutinas asignadas a un usuario alumno",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "idUsuario", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Rutinas asignadas obtenidas." }
        }
      }
    },
    "/rutinas/dia/{dayOfWeek}": {
      "get": {
        "tags": ["Rutinas"],
        "summary": "Obtener rutinas filtradas por el día de la semana asignado",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          { "name": "dayOfWeek", "in": "path", "required": true, "schema": { "type": "string" }, "description": "Ej: Lunes, Martes..." }
        ],
        "responses": {
          "200": { "description": "Rutinas del día obtenidas." }
        }
      }
    },
    "/rutinas/admins/": {
      "get": {
        "tags": ["Rutinas"],
        "summary": "Obtener todas las rutinas del sistema creadas por los admins",
        "security": [{ "bearerAuth": [] }],
        "responses": {
          "200": { "description": "Rutinas administrativas obtenidas." }
        }
      }
    },
    "/rutinas/asignadas": {
      "get": {
        "tags": ["Rutinas"],
        "summary": "Obtener todas las rutinas que el usuario tiene asignadas",
        "security": [{ "bearerAuth": [] }],
        "responses": {
          "200": { "description": "Rutinas asignadas obtenidas." }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "User": {
        "type": "object",
        "properties": {
          "ID_Usuario": {
            "type": "integer",
            "description": "ID único del usuario",
            "example": 1
          },
          "dni": {
            "type": "string",
            "description": "DNI único del usuario",
            "example": "38450123"
          },
          "email": {
            "type": "string",
            "description": "Correo electrónico del usuario",
            "example": "usuario@ejemplo.com"
          },
          "nombre": {
            "type": "string",
            "description": "Nombre del usuario",
            "example": "Juan"
          },
          "apellido": {
            "type": "string",
            "description": "Apellido del usuario",
            "example": "Pérez"
          },
          "password": {
            "type": "string",
            "description": "Contraseña del usuario",
            "example": "miContraseña123"
          },
          "direc": {
            "type": "string",
            "description": "Dirección del usuario",
            "example": "Calle Ficticia 123"
          },
          "tel": {
            "type": "string",
            "description": "Teléfono del usuario",
            "example": "123456789"
          },
          "tipo": {
            "type": "string",
            "description": "Tipo de usuario",
            "example": "cliente"
          },
          "fechaRegistro": {
            "type": "string",
            "format": "date-time",
            "description": "Fecha de registro del usuario",
            "example": "2024-12-10T12:00:00Z"
          },
          "fechaBaja": {
            "type": "string",
            "format": "date-time",
            "description": "Fecha de baja del usuario",
            "example": "2024-12-11T12:00:00Z"
          }
        }
      },
      "Turno": {
        "type": "object",
        "properties": {
          "id_turno": { "type": "integer" },
          "fecha": { "type": "string", "format": "date-time" },
          "estado": { "type": "string" },
          "ID_Usuario": { "type": "integer" },
          "ID_HorarioClase": { "type": "integer" },
          "User": {
            "$ref": "#/components/schemas/User"
          },
          "HorarioClase": {
            "$ref": "#/components/schemas/HorarioClase"
          }
        }
      },
      "TurnoInput": {
        "type": "object",
        "required": ["ID_Usuario", "ID_HorarioClase", "fecha"],
        "properties": {
          "ID_Usuario": { "type": "integer" },
          "ID_HorarioClase": { "type": "integer" },
          "fecha": { "type": "string", "format": "date-time" }
        }
      },
      "HorarioClase": {
        "type": "object",
        "properties": {
          "ID_HorarioClase": {
            "type": "integer",
            "description": "ID único del horario de clase",
            "example": 1
          },
          "diaSemana": {
            "type": "string",
            "description": "Día de la semana para el horario",
            "example": "Lunes"
          },
          "horaIni": {
            "type": "string",
            "format": "date-time",
            "description": "Hora de inicio del horario",
            "example": "2024-12-10T08:00:00Z"
          },
          "horaFin": {
            "type": "string",
            "format": "date-time",
            "description": "Hora de fin del horario",
            "example": "2024-12-10T09:00:00Z"
          },
          "cupos": {
            "type": "integer",
            "description": "Número total de cupos disponibles",
            "example": 20
          },
          "cuposActuales": {
            "type": "integer",
            "description": "Número de cupos ocupados hasta el momento",
            "example": 5
          },
          "ID_Clase": {
            "type": "integer",
            "description": "ID de la clase asociada",
            "example": 1
          }
        }
      },
      "Clase": {
        "type": "object",
        "properties": {
          "ID_Clase": {
            "type": "integer",
            "description": "ID único de la clase",
            "example": 1
          },
          "nombre": {
            "type": "string",
            "description": "Nombre de la clase",
            "example": "Yoga"
          },
          "descripcion": {
            "type": "string",
            "description": "Descripción de la clase",
            "example": "Clase de yoga para principiantes"
          }
        }
      },
      "ImagenClase": {
        "type": "object",
        "properties": {
          "ID_ImgClase": {
            "type": "integer",
            "description": "ID único de la imagen de la clase",
            "example": 1
          },
          "url": {
            "type": "string",
            "description": "URL de la imagen de la clase",
            "example": "http://ejemplo.com/imagen.jpg"
          },
          "ID_Clase": {
            "type": "integer",
            "description": "ID de la clase asociada",
            "example": 1
          }
        }
      },
      "InfoClase": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "description": "ID único de la información de la clase",
            "example": 1
          },
          "tipo": {
            "type": "string",
            "description": "Tipo de información de la clase",
            "example": "material"
          },
          "descripcion": {
            "type": "string",
            "description": "Descripción de la información de la clase",
            "example": "Material necesario para la clase"
          },
          "id_clase": {
            "type": "integer",
            "description": "ID de la clase asociada",
            "example": 1
          }
        }
      }
    },
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    }
  }
};
