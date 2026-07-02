import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireMasterAuth } from "../../shared/auth/guard";
import {
  FishingBaitAmbiguousError,
  FishingBaitNotFoundError,
  FishingBaitRequiredError,
  getFishingProbabilities,
  performFishingAction,
} from "../fishing/fishing.service";

const playerParamsSchema = z.object({
  playerId: z.coerce.number().int().positive(),
});

const fishingActionBodySchema = z
  .object({
    baitItemId: z.string().min(1).optional(),
    baitName: z.string().min(1).optional(),
  })
  .default({});

const fishingProbabilitiesQuerySchema = z.object({
  baitItemId: z.string().min(1).optional(),
  baitName: z.string().min(1).optional(),
});

export async function registerPlayerActionRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/players/:playerId/actions/fish/probabilities",
    {
      preHandler: requireMasterAuth,
    },
    async (request) => {
      const params = playerParamsSchema.parse(request.params);
      const query = fishingProbabilitiesQuerySchema.parse(request.query);

      return {
        actor: request.masterAuth?.username ?? "unknown",
        actingAsPlayerId: params.playerId,
        action: "fish",
        probabilities: await getFishingProbabilities(params.playerId, query),
      };
    },
  );

  app.post(
    "/players/:playerId/actions/fish",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = playerParamsSchema.parse(request.params);
      const body = fishingActionBodySchema.parse(request.body ?? {});

      try {
        const result = await performFishingAction(params.playerId, body);

        return {
          actor: request.masterAuth?.username ?? "unknown",
          actingAsPlayerId: params.playerId,
          action: "fish",
          status: "accepted",
          ...result,
        };
      } catch (error) {
        if (error instanceof FishingBaitRequiredError) {
          return reply.status(400).send({
            message: "Fishing requires bait.",
          });
        }

        if (error instanceof FishingBaitAmbiguousError) {
          return reply.status(400).send({
            message: "Multiple bait types found. Specify baitItemId or baitName.",
          });
        }

        if (error instanceof FishingBaitNotFoundError) {
          return reply.status(404).send({
            message: "Bait not found in player inventory.",
          });
        }

        throw error;
      }
    },
  );
}
