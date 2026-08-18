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
import { adminRouter } from "./modules/admin/admin.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { bookingsRouter } from "./modules/bookings/bookings.routes";
import { carsRouter } from "./modules/cars/cars.routes";
import { conversationsRouter } from "./modules/conversations/conversations.routes";
import { favoritesRouter } from "./modules/favorites/favorites.routes";
import { shopsRouter } from "./modules/shops/shops.routes";
import { usersRouter } from "./modules/users/users.routes";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

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

  app.get("/", (_req, res) => {
    res.status(200).json({
      status: "ok",
      message: "Car Rental API is running",
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/cars", carsRouter);
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/conversations", conversationsRouter);
  app.use("/api/favorites", favoritesRouter);
  app.use("/api/shops", shopsRouter);
  // Further feature routes are mounted here module by module in later phases.

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
