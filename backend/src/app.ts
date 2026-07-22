// Cargar .env ANTES que cualquier otro import: en ESM los imports se evalúan primero,
// y módulos como auth.service leen process.env a nivel de módulo (fail-closed de JWT_SECRET).
import 'dotenv/config';
import cors from "cors";
import dotenv from 'dotenv';
import express from 'express';
import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import helmet, { contentSecurityPolicy } from "helmet";
import type { HelmetOptions } from "helmet";
import morgan from 'morgan';
import { dirname, join } from 'path';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';
import { swaggerDocument } from './docs/swagger.js';
import adminRoutes from './routes/admin.Routes.js';
import asistenciaRoutes from './routes/asistencia.Routes.js';
import authRoutes from './routes/auth.Routes.js';
import claseRoutes from './routes/clase.Routes.js';
import cronRoutes from './routes/cron.Routes.js';
import cuotaRoutes from './routes/cuota.Routes.js';
import ejercicioRoutes from "./routes/ejercicio.Routes.js";
import ejercicioMedicionRoutes from './routes/ejercicioMedicion.Routes.js';
import gastoRoutes from './routes/gasto.Routes.js';
import grupoUsuarioRoutes from './routes/grupoUsuario.Routes.js';
import historicoEjercicioRoutes from './routes/historicoMedicion.Routes.js';
import planRoutes from './routes/plan.Routes.js';
import rutinaRoutes from './routes/rutina.Routes.js';
import turnoRoutes from './routes/turno.Routes.js';
import userRouter from './routes/user.Routes.js';

dotenv.config();
// :=)
const app = express();
const helmetMiddleware = helmet as unknown as (options?: Readonly<HelmetOptions>) => RequestHandler;
// Seguridad básicaaaa
app.set('trust proxy', 1);
app.use(
    helmetMiddleware({
        contentSecurityPolicy: {
            directives: {
                ...contentSecurityPolicy.getDefaultDirectives(),
                "script-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                "img-src": ["'self'", "data:", "validator.swagger.io"],
                "style-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            },
        },
    })
);
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

// Límite general por IP. Las rutas sensibles agregan límites más estrictos.
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 1000,
    message: "Demasiadas peticiones desde esta IP, por favor intente más tarde.",
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(limiter);

const PORT = process.env.PORT || 3000;;

// Reconstruir __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1) Sirve estáticos desde /public
app.use(express.static(join(__dirname, '..', 'public')));

// 2) Swagger UI cargando el esquema en memoria (100% compatible con Vercel)
const swaggerOptions = {
    customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui.min.css',
    customJs: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-bundle.js',
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-standalone-preset.js'
    ]
};

app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, swaggerOptions)
);

// Rutas
app.use('/usuarios', userRouter);
app.use('/usuarios/asistencias', asistenciaRoutes);
app.use('/admin', adminRoutes);
app.use('/auth', authRoutes);
app.use('/clase', claseRoutes);
app.use('/turnos', turnoRoutes);
app.use('/rutinas', rutinaRoutes);
app.use('/grupos-usuarios', grupoUsuarioRoutes);
app.use('/ejercicios-resultados', ejercicioMedicionRoutes);
app.use('/historicoEjercicio', historicoEjercicioRoutes);
app.use('/cuotas', cuotaRoutes);
app.use('/planes', planRoutes);
app.use('/ejercicios', ejercicioRoutes);
app.use('/gastos', gastoRoutes);
app.use('/cron', cronRoutes);

app.use('*', (req, res) => {
    res.status(404).send('Ruta no encontrada');
});

app.listen(PORT, () => {
    console.log(`API corriendo en http://localhost:${PORT}/`);
});

export default app;
