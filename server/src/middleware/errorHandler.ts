import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  console.error(`[${new Date().toISOString()}] Error:`, err.message);
  console.error(err.stack);

  res.status(500).json({
    error: 'Внутренняя ошибка сервера',
  });
}
