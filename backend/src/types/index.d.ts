import { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        ID_Usuario: number;
        email: string;
        tipo: string | null;
      };
    }
  }
}
