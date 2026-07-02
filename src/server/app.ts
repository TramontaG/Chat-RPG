import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../config/env";
import { initializeDatabase } from "../database/setup";
import { registerAdminRoutes } from "../modules/admin/admin.routes";
import { registerAuthRoutes } from "../modules/auth/auth.routes";
import { ensureMasterUser } from "../modules/auth/auth.service";
import { registerPlayerActionRoutes } from "../modules/players/player-actions.routes";
import { registerHealthRoutes } from "../routes/health.routes";

const requestStartTimes = new WeakMap<FastifyRequest, bigint>();

function getClientAddress(request: FastifyRequest): string {
  const forwardedFor = request.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0]?.trim() ?? request.ip;
  }

  return request.ip;
}

function getRequestLogContext(request: FastifyRequest) {
  return {
    request: {
      id: request.id,
      method: request.method,
      url: request.url,
      clientIp: getClientAddress(request),
      userAgent: request.headers["user-agent"] ?? "unknown",
    },
  };
}

function getResponseLogContext(request: FastifyRequest, reply: FastifyReply) {
  const startedAt = requestStartTimes.get(request);
  const responseTimeMs = startedAt
    ? Number(process.hrtime.bigint() - startedAt) / 1_000_000
    : undefined;

  return {
    ...getRequestLogContext(request),
    response: {
      statusCode: reply.statusCode,
      responseTimeMs:
        responseTimeMs === undefined ? undefined : Number(responseTimeMs.toFixed(2)),
    },
  };
}

function isHttpError(error: unknown): error is { message: string; statusCode: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    "statusCode" in error &&
    typeof error.message === "string" &&
    typeof error.statusCode === "number"
  );
}

export async function buildApp() {
  const app = Fastify({
    disableRequestLogging: true,
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          "req.headers.authorization",
          "request.headers.authorization",
          "request.body.password",
          "body.password",
          "password",
          "token",
          "*.token",
          "*.password",
        ],
        censor: "[redacted]",
      },
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
    },
  });

  initializeDatabase();
  await ensureMasterUser();

  app.addHook("onRequest", async (request) => {
    requestStartTimes.set(request, process.hrtime.bigint());
    request.log.info(
      getRequestLogContext(request),
      `${request.method} ${request.url} started`,
    );
  });

  app.addHook("onResponse", async (request, reply) => {
    const statusFamily = Math.floor(reply.statusCode / 100);
    const level = statusFamily >= 5 ? "error" : statusFamily >= 4 ? "warn" : "info";
    const responseLogContext = getResponseLogContext(request, reply);

    requestStartTimes.delete(request);
    request.log[level](
      responseLogContext,
      `${request.method} ${request.url} finished with ${reply.statusCode}`,
    );
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        message: "Invalid request payload.",
        issues: error.issues,
      });
    }

    if (isHttpError(error) && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        message: error.message,
      });
    }

    app.log.error({ err: error }, "Unhandled application error");
    return reply.status(500).send({
      message: "Internal server error.",
    });
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerAdminRoutes(app);
  await registerPlayerActionRoutes(app);

  return {
    app,
    config: {
      PORT: env.PORT,
    },
  };
}
