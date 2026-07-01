import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireMasterAuth } from "../../shared/auth/guard";

const playerParamsSchema = z.object({
  playerId: z.string().min(1),
});

export async function registerPlayerActionRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/players/:playerId/actions/fish",
    {
      preHandler: requireMasterAuth,
    },
    async (request) => {
      const params = playerParamsSchema.parse(request.params);

      return {
        actor: request.masterAuth?.username ?? "unknown",
        actingAsPlayerId: params.playerId,
        action: "fish",
        status: "accepted",
      };
    },
  );
}
