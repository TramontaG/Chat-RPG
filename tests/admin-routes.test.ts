import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

const testDatabasePath = "/tmp/chat-rpg-tests.sqlite";
const masterPassword = "test-master-password";
const testUserId = 2;
const testItemId = "admin_test_fish";

type ServerAppModule = typeof import("../src/server/app");
type DatabaseClientModule = typeof import("../src/database/client");
type DatabaseSetupModule = typeof import("../src/database/setup");
type DatabaseSchemaModule = typeof import("../src/database/schema");
type JwtModule = typeof import("../src/shared/auth/jwt");
type EnvModule = typeof import("../src/config/env");
type BuiltApp = Awaited<ReturnType<ServerAppModule["buildApp"]>>["app"];

let serverApp: ServerAppModule;
let databaseClient: DatabaseClientModule;
let databaseSetup: DatabaseSetupModule;
let schema: DatabaseSchemaModule;
let jwt: JwtModule;
let config: EnvModule;
let app: BuiltApp;

beforeAll(async () => {
  process.env.DATABASE_PATH = testDatabasePath;
  process.env.JWT_SECRET = "temporary-secret-for-admin-route-tests";
  process.env.MASTER_PASSWORD = masterPassword;
  process.env.LOG_LEVEL = "silent";

  serverApp = await import("../src/server/app");
  databaseClient = await import("../src/database/client");
  databaseSetup = await import("../src/database/setup");
  schema = await import("../src/database/schema");
  jwt = await import("../src/shared/auth/jwt");
  config = await import("../src/config/env");

  databaseSetup.initializeDatabase();
  app = (await serverApp.buildApp()).app;
}, 15000);

afterAll(async () => {
  await app?.close();
  databaseClient.sqlite.exec("PRAGMA optimize;");
});

beforeEach(() => {
  databaseClient.db.delete(schema.userBankItems).run();
  databaseClient.db.delete(schema.userBanks).run();
  databaseClient.db.delete(schema.userInventorySlotBonuses).run();
  databaseClient.db.delete(schema.userInventoryItems).run();
  databaseClient.db.delete(schema.userSkills).run();
  databaseClient.db.delete(schema.userAttributePoints).run();
  databaseClient.db.delete(schema.userAttributes).run();
  databaseClient.db.delete(schema.items).run();
  databaseClient.sqlite.exec(`
    DELETE FROM users
    WHERE username <> 'kozz-bot';
  `);

  seedTestUserAndItem();
});

function seedTestUserAndItem(): void {
  const now = new Date().toISOString();

  databaseClient.db
    .insert(schema.users)
    .values({
      id: testUserId,
      username: "admin-route-test-user",
      passwordHash: "test-password-hash",
      role: "player",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  databaseClient.db
    .insert(schema.items)
    .values({
      id: testItemId,
      name: "Admin test fish",
      description: "Item used by admin route tests.",
      category: "material",
      type: "fish",
      rarity: "common",
      stackable: true,
      maxStack: null,
      baseValue: 1,
      metadata: "{}",
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

async function getMasterAuthorization(): Promise<string> {
  return `Bearer ${jwt.signJwt(
    {
      username: "kozz-bot",
      role: "master",
    },
    config.env.JWT_SECRET,
  )}`;
}

describe("admin routes", () => {
  test("rejects requests without master JWT", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/admin/users",
    });

    expect(response.statusCode).toBe(401);
  });

  test("lists users and items", async () => {
    const authorization = await getMasterAuthorization();
    const usersResponse = await app.inject({
      method: "GET",
      url: "/admin/users",
      headers: { authorization },
    });
    const itemsResponse = await app.inject({
      method: "GET",
      url: "/admin/items",
      headers: { authorization },
    });

    expect(usersResponse.statusCode).toBe(200);
    expect(usersResponse.json<{ users: unknown[] }>().users).toHaveLength(2);
    expect(itemsResponse.statusCode).toBe(200);
    expect(itemsResponse.json<{ items: unknown[] }>().items).toHaveLength(1);
  });

  test("creates, reads, updates, and deletes a user", async () => {
    const authorization = await getMasterAuthorization();
    const createResponse = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: { authorization },
      payload: {
        username: "crud-user",
        password: "crud-password",
        role: "player",
      },
    });
    const createdUser = createResponse.json<{ user: { id: number; username: string; role: string } }>().user;

    expect(createResponse.statusCode).toBe(201);
    expect(createdUser).toMatchObject({
      username: "crud-user",
      role: "player",
    });

    const getResponse = await app.inject({
      method: "GET",
      url: `/admin/users/${createdUser.id}`,
      headers: { authorization },
    });

    const getBody = getResponse.json<{
      user: { passwordHash?: string; username: string };
      progression: {
        attributes: Array<{ attribute: string }>;
        skills: Array<{ skill: string }>;
      };
      inventory: unknown[];
    }>();

    expect(getResponse.statusCode).toBe(200);
    expect(getBody.user).toMatchObject({
      username: "crud-user",
    });
    expect(getBody.user.passwordHash).toBeUndefined();
    expect(getBody.progression.attributes.map((attribute) => attribute.attribute).sort()).toEqual([
      "dexterity",
      "intelligence",
      "luck",
      "strength",
      "vitality",
    ]);
    expect(getBody.progression.skills.map((skill) => skill.skill).sort()).toEqual([
      "alchemy",
      "archaeology",
      "cooking",
      "crafting",
      "farming",
      "fishing",
      "magic",
      "melee",
      "mining",
      "potionbrewing",
      "ranged",
      "runemaking",
      "smithing",
      "woodcutting",
    ]);
    expect(getBody.inventory).toEqual([]);

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/admin/users/${createdUser.id}`,
      headers: { authorization },
      payload: {
        username: "crud-user-updated",
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json<{ user: { username: string } }>().user.username).toBe("crud-user-updated");

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/admin/users/${createdUser.id}`,
      headers: { authorization },
    });

    expect(deleteResponse.statusCode).toBe(204);
  });

  test("returns a user's progression", async () => {
    const authorization = await getMasterAuthorization();
    const response = await app.inject({
      method: "GET",
      url: `/admin/users/${testUserId}/progression`,
      headers: { authorization },
    });
    const body = response.json<{
      progression: {
        attributes: unknown[];
        skills: unknown[];
      };
    }>();

    expect(response.statusCode).toBe(200);
    expect(body.progression.attributes).toHaveLength(5);
    expect(body.progression.skills).toHaveLength(14);
  });

  test("adds skill xp and returns progression with recalculated level", async () => {
    const authorization = await getMasterAuthorization();
    const firstGrantResponse = await app.inject({
      method: "POST",
      url: `/admin/users/${testUserId}/progression/skills/fishing/xp`,
      headers: { authorization },
      payload: {
        xp: 99,
      },
    });
    const firstGrantBody = firstGrantResponse.json<{
      grant: { currentXp: number; currentLevel: number; xpRemainingToNextLevel: number };
    }>();

    expect(firstGrantResponse.statusCode).toBe(200);
    expect(firstGrantBody.grant).toMatchObject({
      currentXp: 99,
      currentLevel: 1,
      xpRemainingToNextLevel: 1,
    });

    const secondGrantResponse = await app.inject({
      method: "POST",
      url: `/admin/users/${testUserId}/progression/skills/fishing/xp`,
      headers: { authorization },
      payload: {
        xp: 1,
      },
    });
    const secondGrantBody = secondGrantResponse.json<{
      grant: { currentXp: number; currentLevel: number; xpRemainingToNextLevel: number };
      progression: { skills: Array<{ skill: string; level: number; xp: number; xpForNextLevel: number }> };
    }>();
    const fishingSkill = secondGrantBody.progression.skills.find((skill) => skill.skill === "fishing");

    expect(secondGrantResponse.statusCode).toBe(200);
    expect(secondGrantBody.grant).toMatchObject({
      currentXp: 100,
      currentLevel: 2,
      xpRemainingToNextLevel: 6,
    });
    expect(fishingSkill).toMatchObject({
      skill: "fishing",
      level: 2,
      xp: 100,
      xpForNextLevel: 106,
    });
  });

  test("spends earned attribute points on an attribute", async () => {
    const authorization = await getMasterAuthorization();
    await app.inject({
      method: "POST",
      url: `/admin/users/${testUserId}/progression/skills/fishing/xp`,
      headers: { authorization },
      payload: {
        xp: 153,
      },
    });

    const response = await app.inject({
      method: "POST",
      url: `/admin/users/${testUserId}/progression/attributes/dexterity/points`,
      headers: { authorization },
      payload: {
        levels: 2,
      },
    });
    const body = response.json<{
      spend: {
        cost: number;
        previousLevel: number;
        currentLevel: number;
        attributePoints: { availablePoints: number; totalEarned: number; totalSpent: number };
      };
      progression: {
        attributePoints: { availablePoints: number };
        attributes: Array<{ attribute: string; level: number }>;
      };
    }>();
    const dexterity = body.progression.attributes.find((attribute) => attribute.attribute === "dexterity");

    expect(response.statusCode).toBe(200);
    expect(body.spend).toMatchObject({
      cost: 5,
      previousLevel: 1,
      currentLevel: 3,
      attributePoints: {
        availablePoints: 20,
        totalEarned: 25,
        totalSpent: 5,
      },
    });
    expect(body.progression.attributePoints.availablePoints).toBe(20);
    expect(dexterity?.level).toBe(3);
  });

  test("creates, reads, updates, and soft-deletes an item", async () => {
    const authorization = await getMasterAuthorization();
    const itemId = "crud_test_item";
    const createResponse = await app.inject({
      method: "POST",
      url: "/admin/items",
      headers: { authorization },
      payload: {
        id: itemId,
        name: "CRUD test item",
        description: "Created by route test.",
        category: "material",
        type: "test_material",
        rarity: "common",
        stackable: true,
        metadata: {
          test: true,
        },
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json<{ item: { id: string; status: string } }>().item).toMatchObject({
      id: itemId,
      status: "active",
    });

    const getResponse = await app.inject({
      method: "GET",
      url: `/admin/items/${itemId}`,
      headers: { authorization },
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json<{ item: { id: string; name: string } }>().item).toMatchObject({
      id: itemId,
      name: "CRUD test item",
    });

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/admin/items/${itemId}`,
      headers: { authorization },
      payload: {
        name: "CRUD test item updated",
        baseValue: 25,
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json<{ item: { name: string; baseValue: number } }>().item).toMatchObject({
      name: "CRUD test item updated",
      baseValue: 25,
    });

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/admin/items/${itemId}`,
      headers: { authorization },
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json<{ item: { status: string } }>().item.status).toBe("disabled");
  });

  test("adds and removes an item from user inventory", async () => {
    const authorization = await getMasterAuthorization();
    const addResponse = await app.inject({
      method: "POST",
      url: `/admin/users/${testUserId}/inventory/items/${testItemId}`,
      headers: { authorization },
      payload: { quantity: 3 },
    });

    expect(addResponse.statusCode).toBe(200);
    expect(addResponse.json<{ inventory: Array<{ itemId: string; quantity: number }> }>().inventory).toMatchObject([
      {
        itemId: testItemId,
        quantity: 3,
      },
    ]);

    const removeResponse = await app.inject({
      method: "DELETE",
      url: `/admin/users/${testUserId}/inventory/items/${testItemId}`,
      headers: { authorization },
      payload: { quantity: 2 },
    });

    expect(removeResponse.statusCode).toBe(200);
    expect(
      removeResponse.json<{ inventory: Array<{ itemId: string; quantity: number }> }>().inventory,
    ).toMatchObject([
      {
        itemId: testItemId,
        quantity: 1,
      },
    ]);
  });

  test("returns 404 instead of 500 when adding an unknown item to inventory", async () => {
    const authorization = await getMasterAuthorization();
    const addResponse = await app.inject({
      method: "POST",
      url: `/admin/users/${testUserId}/inventory/items/unknown-item`,
      headers: { authorization },
      payload: { quantity: 1 },
    });

    expect(addResponse.statusCode).toBe(404);
    expect(addResponse.json<{ message: string }>()).toEqual({
      message: "Item not found.",
    });
  });

  test("returns a user's bank", async () => {
    const authorization = await getMasterAuthorization();
    await app.inject({
      method: "POST",
      url: `/admin/users/${testUserId}/bank/items/${testItemId}`,
      headers: { authorization },
      payload: { quantity: 5 },
    });

    const bankResponse = await app.inject({
      method: "GET",
      url: `/admin/users/${testUserId}/bank`,
      headers: { authorization },
    });
    const bankBody = bankResponse.json<{
      bank: { userId: number; gold: number };
      items: Array<{ itemId: string; quantity: number }>;
    }>();

    expect(bankResponse.statusCode).toBe(200);
    expect(bankBody.bank).toMatchObject({ userId: testUserId, gold: 0 });
    expect(bankBody.items).toMatchObject([{ itemId: testItemId, quantity: 5 }]);
  });
});
