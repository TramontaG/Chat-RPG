import Fastify from "fastify";
import { z } from "zod";
import { env } from "../config/env";
import { initializeDatabase } from "../database/setup";
import { registerAuthRoutes } from "../modules/auth/auth.routes";
import { ensureMasterUser } from "../modules/auth/auth.service";
import { registerPlayerActionRoutes } from "../modules/players/player-actions.routes";
import { registerHealthRoutes } from "../routes/health.routes";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  initializeDatabase();
  await ensureMasterUser();

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        message: "Invalid request payload.",
        issues: error.issues,
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      message: "Internal server error.",
    });
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerPlayerActionRoutes(app);

  return {
    app,
    config: {
      PORT: env.PORT,
    },
  };
}
