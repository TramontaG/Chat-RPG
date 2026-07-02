import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  addItemToBank,
  BankSlotNotFoundError,
  depositInventorySlotToBank,
  getUserBank,
  InsufficientGoldError,
  listBankItems,
  withdrawBankSlotToInventory,
} from "../bank/bank.service";
import {
  addItemToInventory,
  InventorySlotNotFoundError,
  listInventoryItems,
  removeItemFromInventory,
} from "../inventory/inventory.service";
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
  createGuild,
  GuildAlreadyExistsError,
  GuildNotFoundError,
  joinGuild,
  leaveGuild,
  listGuildMemberships,
  listGuilds,
  listUserGuildMemberships,
} from "../guilds/guilds.service";
import {
  buyBaitFromShop,
  ItemIsNotBaitError,
  listBaitShopItems,
  sellInventorySlotToGame,
} from "../shop/shop.service";
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

const userInventorySlotParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
  inventorySlotId: z.coerce.number().int().positive(),
});

const userBankSlotParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
  bankSlotId: z.coerce.number().int().positive(),
});

const guildParamsSchema = z.object({
  guildId: z.coerce.number().int().positive(),
});

const userGuildParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
  guildId: z.coerce.number().int().positive(),
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

const createGuildBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
});

const guildMembershipBodySchema = z
  .object({
    role: z.string().min(1).default("member"),
  })
  .default({ role: "member" });

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
          bank: await getUserBank(params.userId),
          guilds: await listUserGuildMemberships(params.userId),
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
    "/admin/guilds",
    {
      preHandler: requireMasterAuth,
    },
    async () => {
      return {
        guilds: await listGuilds(),
      };
    },
  );

  app.post(
    "/admin/guilds",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const body = createGuildBodySchema.parse(request.body);

      try {
        return reply.status(201).send({
          guild: await createGuild(body),
        });
      } catch (error) {
        if (error instanceof GuildAlreadyExistsError) {
          return reply.status(409).send({
            message: "Guild already exists.",
          });
        }

        throw error;
      }
    },
  );

  app.get(
    "/admin/guilds/:guildId/members",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = guildParamsSchema.parse(request.params);

      try {
        return {
          members: await listGuildMemberships(params.guildId),
        };
      } catch (error) {
        if (error instanceof GuildNotFoundError) {
          return reply.status(404).send({
            message: "Guild not found.",
          });
        }

        throw error;
      }
    },
  );

  app.post(
    "/admin/users/:userId/guilds/:guildId",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = userGuildParamsSchema.parse(request.params);
      const body = guildMembershipBodySchema.parse(request.body ?? {});

      try {
        await getUser(params.userId);
        return {
          membership: await joinGuild(params.userId, params.guildId, body.role),
          guilds: await listUserGuildMemberships(params.userId),
        };
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.status(404).send({
            message: "User not found.",
          });
        }

        if (error instanceof GuildNotFoundError) {
          return reply.status(404).send({
            message: "Guild not found.",
          });
        }

        throw error;
      }
    },
  );

  app.delete(
    "/admin/users/:userId/guilds/:guildId",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = userGuildParamsSchema.parse(request.params);

      try {
        await getUser(params.userId);
        const removed = await leaveGuild(params.userId, params.guildId);

        if (!removed) {
          return reply.status(404).send({
            removed: false,
            reason: "membership_not_found",
          });
        }

        return {
          removed: true,
          guilds: await listUserGuildMemberships(params.userId),
        };
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.status(404).send({
            message: "User not found.",
          });
        }

        if (error instanceof GuildNotFoundError) {
          return reply.status(404).send({
            message: "Guild not found.",
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

  app.post(
    "/admin/users/:userId/shop/sell/inventory-slots/:inventorySlotId",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = userInventorySlotParamsSchema.parse(request.params);
      const body = quantityBodySchema.parse(request.body ?? {});

      try {
        await getUser(params.userId);
        const result = await sellInventorySlotToGame(
          params.userId,
          params.inventorySlotId,
          body.quantity,
        );

        if (!result) {
          return reply.status(409).send({
            sold: false,
            reason: "insufficient_quantity",
          });
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

        if (error instanceof InventorySlotNotFoundError) {
          return reply.status(404).send({
            message: "Inventory slot not found.",
          });
        }

        if (error instanceof ItemNotFoundError) {
          return reply.status(404).send({
            message: "Item not found.",
          });
        }

        throw error;
      }
    },
  );

  app.get(
    "/admin/shop/baits",
    {
      preHandler: requireMasterAuth,
    },
    async () => {
      return {
        baits: listBaitShopItems(),
      };
    },
  );

  app.post(
    "/admin/users/:userId/shop/buy/baits/:itemId",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = userItemParamsSchema.parse(request.params);
      const body = quantityBodySchema.parse(request.body ?? {});

      try {
        await getUser(params.userId);
        const result = await buyBaitFromShop(params.userId, params.itemId, body.quantity);

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

        if (error instanceof ItemIsNotBaitError) {
          return reply.status(409).send({
            message: "Item is not bait.",
          });
        }

        if (error instanceof InsufficientGoldError) {
          return reply.status(409).send({
            message: error.message,
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
    "/admin/users/:userId/bank/deposits/inventory-slots/:inventorySlotId",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = userInventorySlotParamsSchema.parse(request.params);
      const body = quantityBodySchema.parse(request.body ?? {});

      try {
        await getUser(params.userId);
        const deposited = await depositInventorySlotToBank(
          params.userId,
          params.inventorySlotId,
          body.quantity,
        );

        if (!deposited) {
          return reply.status(409).send({
            deposited: false,
            reason: "slot_not_found_or_insufficient_quantity",
          });
        }

        return {
          deposited: true,
          bank: await getUserBank(params.userId),
          bankItems: await listBankItems(params.userId),
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

  app.post(
    "/admin/users/:userId/bank/withdrawals/bank-slots/:bankSlotId",
    {
      preHandler: requireMasterAuth,
    },
    async (request, reply) => {
      const params = userBankSlotParamsSchema.parse(request.params);
      const body = quantityBodySchema.parse(request.body ?? {});

      try {
        await getUser(params.userId);
        const withdrawn = await withdrawBankSlotToInventory(
          params.userId,
          params.bankSlotId,
          body.quantity,
        );

        if (!withdrawn) {
          return reply.status(409).send({
            withdrawn: false,
            reason: "inventory_full_or_insufficient_quantity",
          });
        }

        return {
          withdrawn: true,
          bank: await getUserBank(params.userId),
          bankItems: await listBankItems(params.userId),
          inventory: await listInventoryItems(params.userId),
        };
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.status(404).send({
            message: "User not found.",
          });
        }

        if (error instanceof BankSlotNotFoundError) {
          return reply.status(404).send({
            message: "Bank slot not found.",
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
