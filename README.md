# GymHour Template

Monorepo base para deployar clientes nuevos de GymHour. Cada cliente es un
`git clone` de este repo con su propia configuración.

```
gymhour-template/
├── backend/     API Node/Express/TypeScript/Prisma (deploy serverless en Vercel)
├── frontend/    React (CRA)
└── package.json npm workspaces
```

La configuración que cambia por cliente está concentrada en dos lugares:

- **Backend**: variables de entorno (`.env` / panel de Vercel). Ver `backend/.env.example`.
- **Frontend**: `frontend/src/setup.js` (branding, colores, pago, WhatsApp, API URL).
  El `.env` del frontend es **opcional** (ver más abajo).

---

## Instalación

Desde la raíz del monorepo (usa npm workspaces, instala backend + frontend):

```bash
npm install
```

Levantar en desarrollo:

```bash
npm run dev            # backend + frontend juntos (concurrently)
npm run dev:backend    # solo API en http://localhost:3000
npm run dev:frontend   # solo front (CRA) apuntando a la API local
```

Builds de producción:

```bash
npm run build:backend
npm run build:frontend
```

---

## Crear un cliente nuevo

1. `git clone` de este repo con el nombre del cliente.
2. Crear la base de datos MySQL del cliente (una propia, **no** reutilizar la de otro).
3. Configurar el **backend** (env vars) y el **frontend** (`setup.js`).
4. Sincronizar el schema en la base nueva (`npx prisma db push`).
5. Deployar backend, después frontend.
6. Probar el flujo completo.

---

## 1. Backend

Config 100% por variables de entorno (el código no tiene nada del cliente hardcodeado).
Ver `backend/.env.example` para la lista completa.

Variables que cambian **por cliente**:

```
DATABASE_URL=mysql://usuario:password@host:puerto/database
FRONTEND_URL=https://frontend-del-cliente.com
```

- `DATABASE_URL`: base MySQL del cliente. Prisma la toma desde `backend/prisma/schema.prisma`.
- `FRONTEND_URL`: dominio público del frontend. Se usa en links de emails (ej. recupero de password).

Variables **compartidas** (solo cambian si el cliente tiene credenciales propias):
`JWT_SECRET`, `SMTP_*`, `CLOUDINARY_*`.

### Base de datos (paso obligatorio)

El `vercel-build` corre `prisma generate` + compila TypeScript, pero **no** sincroniza el
schema. Para una base nueva hay que correr **una vez**, apuntando a la `DATABASE_URL` del
cliente, antes o justo después del primer deploy:

```bash
npx prisma db push        # (o las migraciones) — sincroniza el schema en la base
npm run seed              # opcional: datos iniciales
```

### Deploy en Vercel

El backend ya trae `backend/vercel.json` (rewrites, funciones serverless en `api/` y crons).
El script `vercel-build` corre `prisma generate` + compila TypeScript.

### Checklist backend

- [ ] Base MySQL del cliente creada.
- [ ] `DATABASE_URL` y `FRONTEND_URL` configuradas.
- [ ] Variables extra (email, imágenes, auth) configuradas.
- [ ] Schema sincronizado en la base (`npx prisma db push`).
- [ ] Deploy ejecutado y API respondiendo.

---

## 2. Frontend

### `frontend/src/setup.js`

Único archivo a editar por cliente. Concentra branding, colores, pago y API URL.
Por defecto trae el branding de **GymHour** (logos + color `#DB4632`):

```js
const CLIENT_SETUP = {
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  branding: {
    name: 'GymHour',
    logoAlt: 'GymHour',
    logo: logoDark,        // fondo oscuro (dark theme)
    logoLight: logoLight,  // fondo claro (light theme)
    theme: {
      primaryColor: '#DB4632',
      primaryColorHover: '#E35D4B',
      backgroundHoverColor: '#DB463230',
    },
  },
  payment: {
    accountHolder: 'WELLNESS GYM',
    alias: 'zeus.training.club',
    cbu: '0000003100051208535818',
    cuil: '',
    whatsapp: {
      phoneNumber: '5492216783402',   // con código de país, sin "+"
      message: 'Hola! Les comparto el comprobante de pago de este mes:',
    },
  },
};
```

- `apiUrl`: URL pública de la API. El `.env` del frontend es **opcional**: si el hosting
  permite env vars, `REACT_APP_API_URL` tiene prioridad; si no, se configura acá en `apiUrl`.
- `branding.theme`: los colores se inyectan como CSS variables en `src/index.js` al iniciar.
  El default también está en `src/variables.css` (evita el flash antes de que cargue el JS).
- `payment` / `whatsapp`: se consumen en la pantalla de Cuotas.

### Logos

El template usa por defecto los logos de **GymHour**, con variante por tema:

- `logo`: versión para fondo **oscuro** (dark theme).
- `logoLight`: versión para fondo **claro** (light theme). Si no se define, cae en `logo`.

Login y Sidebar eligen la variante según el tema activo. Para un cliente con logo propio,
reemplazar los imports al inicio de `setup.js` por los archivos del cliente (si solo tiene
una variante, apuntar `logo` y `logoLight` al mismo archivo).

### Branding estático (edición manual, opcional)

Estos archivos **no** leen `setup.js` (son estáticos) y ya traen el branding GymHour por
defecto. Solo hay que editarlos si el cliente quiere branding PWA/favicon propio:

- `frontend/public/index.html` → `<title>`, `<meta name="description">`, `theme-color`, `apple-mobile-web-app-title`.
- `frontend/public/manifest.json` → `name`, `short_name`, `theme_color`.
- `frontend/public/*.png` → íconos PWA/favicon (`logo_192`, `logo_512`, `maskable_512`, `apple-touch-icon`).

### Deploy en Vercel

`frontend/vercel.json` ya trae headers de cache y el rewrite a `index.html` (SPA).
El build queda en `frontend/build`.

### Checklist frontend

- [ ] `setup.js` editado con los datos del cliente (o dejado con el branding GymHour).
- [ ] `apiUrl` apuntando a la API correcta.
- [ ] Logos configurados (default GymHour o los del cliente).
- [ ] (Opcional) `index.html` / `manifest.json` / íconos PWA con la marca del cliente.
- [ ] Build + deploy ejecutados.
- [ ] Probado: login, recupero de password, cuotas y botón de WhatsApp.

---

## 3. Orden recomendado de deploy

1. Crear la base MySQL del cliente.
2. Deployar la API con `DATABASE_URL` y `FRONTEND_URL`.
3. Sincronizar el schema (`npx prisma db push`) y verificar que la API responde.
4. Editar `frontend/src/setup.js` con la URL de la API y los datos del cliente.
5. Deployar el frontend.
6. Ajustar `FRONTEND_URL` en la API si el dominio final cambió.
7. Probar el flujo completo desde el dominio público del cliente.

## 4. Resumen rápido

- Backend: `DATABASE_URL` + `FRONTEND_URL` (+ vars compartidas) + `prisma db push`.
- Frontend: `setup.js` (branding, colores, pago, API URL). `.env` opcional.
- Deploy API → Deploy frontend → probar.
