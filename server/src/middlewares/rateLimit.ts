import rateLimit from "express-rate-limit";
import { env } from "../config/env";

// Rate limiting is disabled in the test environment so integration tests can
// exercise auth flows repeatedly without tripping the same limits real
// credential-guessing traffic would hit.
const skipInTest = () => env.NODE_ENV === "test";

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
});

const authAttemptMessage = { error: { message: "Too many attempts, please try again later." } };

// Separate instances (not one shared limiter) so exhausting the signup budget
// doesn't also lock out login attempts from the same IP, and vice versa.
export const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: authAttemptMessage,
  skip: skipInTest,
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: authAttemptMessage,
  skip: skipInTest,
});
