// import app from '../src/app.js'
// export default app;
import type { Request, Response } from "express";
import app from "../dist/app.js";     // tu Express "app"

export default function handler(req: Request, res: Response) {
  return new Promise<void>((resolve, reject) => {
    app(req, res, (err?: unknown) => {
      if (err) return reject(err);
      resolve();
    });
  });
}
