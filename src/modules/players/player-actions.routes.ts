import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireMasterAuth } from "../../shared/auth/guard";
import { performFishingAction } from "../fishing/fishing.service";

const playerParamsSchema = z.object({
  playerId: z.coerce.number().int().positive(),
});

export async function registerPlayerActionRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/players/:playerId/actions/fish",
    {
      preHandler: requireMasterAuth,
    },
    async (request) => {
      const params = playerParamsSchema.parse(request.params);
      const result = await performFishingAction(params.playerId);

      return {
        actor: request.masterAuth?.username ?? "unknown",
        actingAsPlayerId: params.playerId,
        action: "fish",
        status: "accepted",
        ...result,
      };
    },
  );
}
