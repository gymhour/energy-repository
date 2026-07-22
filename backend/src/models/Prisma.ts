import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    //log: ['query', 'info', 'warn', 'error'], // Registra todas las consultas y errores
  });
export default prisma;
