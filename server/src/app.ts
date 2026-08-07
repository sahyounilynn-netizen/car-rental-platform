import express from "express";
import helmet from "helmet";
import cors from "cors";
import hpp from "hpp";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { generalLimiter } from "./middlewares/rateLimit";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { carsRouter } from "./modules/cars/cars.routes";
import { usersRouter } from "./modules/users/users.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(hpp());
  app.use(pinoHttp({ logger }));
  app.use(generalLimiter);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/cars", carsRouter);
  // Further feature routes are mounted here module by module in later phases.

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
