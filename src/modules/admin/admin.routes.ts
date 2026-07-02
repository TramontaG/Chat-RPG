import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { addItemToBank, getUserBank, listBankItems } from "../bank/bank.service";
import { addItemToInventory, listInventoryItems, removeItemFromInventory } from "../inventory/inventory.service";
import {
  createItem,
  disableItem,
  getItemOrThrow,
  ItemAlreadyExistsError,
  ItemNotFoundError,
  ItemUnavailableError,
  listItems,
  updateItem,
} from "../items/items.service";
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser,
  UsernameAlreadyExistsError,
  UserNotFoundError,
} from "../users/users.service";
import {
  getUserProgression,
  grantSkillXp,
  InsufficientAttributePointsError,
  spendAttributePoints,
} from "../progression/progression.service";
import { requireMasterAuth } from "../../shared/auth/guard";

const userParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

const userItemParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
  itemId: z.string().min(1),
});

const userSkillParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
  skill: z.enum([
    "fishing",
    "woodcutting",
    "mining",
    "farming",
    "cooking",
    "smithing",
    "crafting",
    "archaeology",
    "melee",
    "ranged",
    "magic",
    "runemaking",
    "alchemy",
    "potionbrewing",
  ]),
});

const userAttributeParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
  attribute: z.enum(["strength", "vitality", "dexterity", "intelligence", "luck"]),
});

const itemParamsSchema = z.object({
  itemId: z.string().min(1),
});

const userRoleSchema = z.enum(["master", "player"]);
const itemCategorySchema = z.enum(["equipment", "consumable", "material", "treasure"]);
const itemRaritySchema = z.enum(["common", "uncommon", "rare", "epic", "legendary"]);
const itemStatusSchema = z.enum(["active", "deprecated", "disabled"]);

const createUserBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  role: userRoleSchema.default("player"),
});

const updateUserBodySchema = z
  .object({
    username: z.string().min(1).optional(),
    password: z.string().min(1).optional(),
    role: userRoleSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided.",
  });

const createItemBodySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  category: itemCategorySchema,
  type: z.string().min(1),
  rarity: itemRaritySchema.default("common"),
  stackable: z.boolean().default(true),
  maxStack: z.number().int().positive().nullable().default(null),
  baseValue: z.number().int().min(0).default(0),
  metadata: z.unknown().default({}),
  status: itemStatusSchema.default("active"),
});

const updateItemBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    category: itemCategorySchema.optional(),
    type: z.string().min(1).optional(),
    rarity: itemRaritySchema.optional(),
    stackable: z.boolean().optional(),
    maxStack: z.number().int().positive().nullable().optional(),
    baseValue: z.number().int().min(0).optional(),
    metadata: z.unknown().optional(),
    status: itemStatusSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided.",
  });

const quantityBodySchema = z
  .object({
    quantity: z.coerce.number().int().positive().default(1),
  })
  .default({ quantity: 1 });

const xpBodySchema = z.object({
  xp: z.coerce.number().int().positive(),
});

const attributePointSpendBodySchema = z
  .object({
    levels: z.coerce.number().int().positive().default(1),
  })
  .default({ levels: 1 });

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/admin/users",
    {
      preHandler: requireMasterAuth,
    },
    async () => {
      return {
        users: await listUsers(),
      };
    },
  );

  app.post(
    "/admin/users",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const body = createUserBodySchema.parse(request.body);

      try {
        return reply.status(201).send({
          user: await createUser(body),
        });
      } catch (error) {
        if (error instanceof UsernameAlreadyExistsError) {
          return reply.status(409).send({
            message: "Username already exists.",
          });
        }

        throw error;
      }
    },
  );

  app.get(
    "/admin/users/:userId",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = userParamsSchema.parse(request.params);

      try {
        const user = await getUser(params.userId);

        return {
          user,
          progression: await getUserProgression(params.userId),
          inventory: await listInventoryItems(params.userId),
        };
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.status(404).send({
            message: "User not found.",
          });
        }

        throw error;
      }
    },
  );

  app.get(
    "/admin/users/:userId/progression",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = userParamsSchema.parse(request.params);

      try {
        await getUser(params.userId);
        return {
          progression: await getUserProgression(params.userId),
        };
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.status(404).send({
            message: "User not found.",
          });
        }

        throw error;
      }
    },
  );

  app.post(
    "/admin/users/:userId/progression/skills/:skill/xp",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = userSkillParamsSchema.parse(request.params);
      const body = xpBodySchema.parse(request.body);

      try {
        await getUser(params.userId);
        return {
          skill: params.skill,
          grant: await grantSkillXp(params.userId, params.skill, body.xp),
          progression: await getUserProgression(params.userId),
        };
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.status(404).send({
            message: "User not found.",
          });
        }

        throw error;
      }
    },
  );

  app.post(
    "/admin/users/:userId/progression/attributes/:attribute/points",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = userAttributeParamsSchema.parse(request.params);
      const body = attributePointSpendBodySchema.parse(request.body);

      try {
        await getUser(params.userId);
        return {
          attribute: params.attribute,
          spend: await spendAttributePoints(params.userId, params.attribute, body.levels),
          progression: await getUserProgression(params.userId),
        };
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.status(404).send({
            message: "User not found.",
          });
        }

        if (error instanceof InsufficientAttributePointsError) {
          return reply.status(409).send({
            message: error.message,
          });
        }

        throw error;
      }
    },
  );

  app.patch(
    "/admin/users/:userId",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = userParamsSchema.parse(request.params);
      const body = updateUserBodySchema.parse(request.body);

      try {
        return {
          user: await updateUser(params.userId, body),
        };
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.status(404).send({
            message: "User not found.",
          });
        }

        if (error instanceof UsernameAlreadyExistsError) {
          return reply.status(409).send({
            message: "Username already exists.",
          });
        }

        throw error;
      }
    },
  );

  app.delete(
    "/admin/users/:userId",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = userParamsSchema.parse(request.params);

      try {
        await deleteUser(params.userId);
        return reply.status(204).send();
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.status(404).send({
            message: "User not found.",
          });
        }

        throw error;
      }
    },
  );

  app.get(
    "/admin/items",
    {
      preHandler: requireMasterAuth,
    },
    async () => {
      return {
        items: await listItems(),
      };
    },
  );

  app.post(
    "/admin/items",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const body = createItemBodySchema.parse(request.body);

      try {
        return reply.status(201).send({
          item: await createItem(body),
        });
      } catch (error) {
        if (error instanceof ItemAlreadyExistsError) {
          return reply.status(409).send({
            message: "Item already exists.",
          });
        }

        throw error;
      }
    },
  );

  app.get(
    "/admin/items/:itemId",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = itemParamsSchema.parse(request.params);

      try {
        return {
          item: await getItemOrThrow(params.itemId),
        };
      } catch (error) {
        if (error instanceof ItemNotFoundError) {
          return reply.status(404).send({
            message: "Item not found.",
          });
        }

        throw error;
      }
    },
  );

  app.patch(
    "/admin/items/:itemId",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = itemParamsSchema.parse(request.params);
      const body = updateItemBodySchema.parse(request.body);

      try {
        return {
          item: await updateItem(params.itemId, body),
        };
      } catch (error) {
        if (error instanceof ItemNotFoundError) {
          return reply.status(404).send({
            message: "Item not found.",
          });
        }

        throw error;
      }
    },
  );

  app.delete(
    "/admin/items/:itemId",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = itemParamsSchema.parse(request.params);

      try {
        return {
          item: await disableItem(params.itemId),
        };
      } catch (error) {
        if (error instanceof ItemNotFoundError) {
          return reply.status(404).send({
            message: "Item not found.",
          });
        }

        throw error;
      }
    },
  );

  app.post(
    "/admin/users/:userId/inventory/items/:itemId",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = userItemParamsSchema.parse(request.params);
      const body = quantityBodySchema.parse(request.body ?? {});

      try {
        await getUser(params.userId);
        const result = await addItemToInventory(params.userId, params.itemId, body.quantity);

        if (!result.added) {
          return reply.status(409).send(result);
        }

        return {
          ...result,
          inventory: await listInventoryItems(params.userId),
        };
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.status(404).send({
            message: "User not found.",
          });
        }

        if (error instanceof ItemNotFoundError) {
          return reply.status(404).send({
            message: "Item not found.",
          });
        }

        if (error instanceof ItemUnavailableError) {
          return reply.status(409).send({
            message: "Item is not active.",
          });
        }

        throw error;
      }
    },
  );

  app.delete(
    "/admin/users/:userId/inventory/items/:itemId",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = userItemParamsSchema.parse(request.params);
      const body = quantityBodySchema.parse(request.body ?? {});

      try {
        await getUser(params.userId);
        const removed = await removeItemFromInventory(params.userId, params.itemId, body.quantity);

        if (!removed) {
          return reply.status(404).send({
            removed: false,
            reason: "item_not_found_or_insufficient_quantity",
            userId: params.userId,
            itemId: params.itemId,
            quantity: body.quantity,
          });
        }

        return {
          removed: true,
          userId: params.userId,
          itemId: params.itemId,
          quantity: body.quantity,
          inventory: await listInventoryItems(params.userId),
        };
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.status(404).send({
            message: "User not found.",
          });
        }

        if (error instanceof ItemNotFoundError) {
          return reply.status(404).send({
            message: "Item not found.",
          });
        }

        if (error instanceof ItemUnavailableError) {
          return reply.status(409).send({
            message: "Item is not active.",
          });
        }

        throw error;
      }
    },
  );

  app.get(
    "/admin/users/:userId/bank",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = userParamsSchema.parse(request.params);

      try {
        await getUser(params.userId);
        return {
          bank: await getUserBank(params.userId),
          items: await listBankItems(params.userId),
        };
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.status(404).send({
            message: "User not found.",
          });
        }

        throw error;
      }
    },
  );

  app.post(
    "/admin/users/:userId/bank/items/:itemId",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = userItemParamsSchema.parse(request.params);
      const body = quantityBodySchema.parse(request.body ?? {});

      try {
        await getUser(params.userId);
        await addItemToBank(params.userId, params.itemId, body.quantity);

        return {
          bank: await getUserBank(params.userId),
          items: await listBankItems(params.userId),
        };
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.status(404).send({
            message: "User not found.",
          });
        }

        if (error instanceof ItemNotFoundError) {
          return reply.status(404).send({
            message: "Item not found.",
          });
        }

        if (error instanceof ItemUnavailableError) {
          return reply.status(409).send({
            message: "Item is not active.",
          });
        }

        throw error;
      }
    },
  );
}
