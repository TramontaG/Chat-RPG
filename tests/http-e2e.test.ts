import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { InjectOptions } from "light-my-request";

const testDatabasePath = "/tmp/chat-rpg-tests.sqlite";
const testUserId = 3;
const testItemId = "http_e2e_fish";

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
  process.env.JWT_SECRET = "temporary-secret-for-http-e2e-tests";
  process.env.MASTER_PASSWORD = "test-master-password";
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
    WHERE id = ${testUserId}
      OR username IN (
      'inventory-bank-test-user',
      'admin-route-test-user',
      'progression-test-user',
      'http-e2e-user',
      'http-e2e-signup-user'
    );
  `);

  seedTestUserAndItem();
});

function seedTestUserAndItem(): void {
  const now = new Date().toISOString();

  databaseClient.db
    .insert(schema.users)
    .values({
      id: testUserId,
      username: "http-e2e-user",
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
      name: "HTTP E2E fish",
      description: "Item used by HTTP E2E tests.",
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

function getMasterAuthorization(): string {
  return `Bearer ${jwt.signJwt(
    {
      username: "kozz-bot",
      role: "master",
    },
    config.env.JWT_SECRET,
  )}`;
}

async function requestJson<TBody>(
  path: string,
  init: {
    method?: InjectOptions["method"];
    headers?: Record<string, string>;
    body?: TBody;
  } = {},
) {
  const options: InjectOptions = {
    method: init.method ?? "GET",
    url: path,
    headers: {
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(init.headers ?? {}),
    },
    payload: init.body === undefined ? undefined : JSON.stringify(init.body),
  };
  const response = await app.inject(options);

  return {
    status: response.statusCode,
    json: <TResponse>() => response.json<TResponse>(),
  };
}

describe("HTTP e2e", () => {
  test("signs up a player over HTTP", async () => {
    const response = await requestJson("/auth/signup", {
      method: "POST",
      body: {
        username: "http-e2e-signup-user",
        password: "test-password",
      },
    });
    const body = response.json<{
      token: string;
      tokenType: string;
      user: { username: string; role: string };
    }>();

    expect(response.status).toBe(201);
    expect(body.token).toBeString();
    expect(body.tokenType).toBe("Bearer");
    expect(body.user).toMatchObject({
      username: "http-e2e-signup-user",
      role: "player",
    });
  });

  test("rejects duplicate signup over HTTP", async () => {
    const payload = {
      username: "http-e2e-signup-user",
      password: "test-password",
    };

    expect((await requestJson("/auth/signup", { method: "POST", body: payload })).status).toBe(201);

    const duplicateResponse = await requestJson("/auth/signup", {
      method: "POST",
      body: payload,
    });

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.json<{ message: string }>()).toEqual({
      message: "Username already exists.",
    });
  });

  test("adds an item to user inventory over HTTP", async () => {
    const response = await requestJson(
      `/admin/users/${testUserId}/inventory/items/${testItemId}`,
      {
        method: "POST",
        headers: {
          Authorization: getMasterAuthorization(),
        },
        body: {
          quantity: 3,
        },
      },
    );
    const body = response.json<{
      added: boolean;
      inventory: Array<{ itemId: string; quantity: number }>;
    }>();

    expect(response.status).toBe(200);
    expect(body.added).toBe(true);
    expect(body.inventory).toMatchObject([
      {
        itemId: testItemId,
        quantity: 3,
      },
    ]);
  });

  test("returns 404 instead of 500 when adding an unknown item over HTTP", async () => {
    const response = await requestJson(
      `/admin/users/${testUserId}/inventory/items/unknown-item`,
      {
        method: "POST",
        headers: {
          Authorization: getMasterAuthorization(),
        },
        body: {
          quantity: 1,
        },
      },
    );

    expect(response.status).toBe(404);
    expect(response.json<{ message: string }>()).toEqual({
      message: "Item not found.",
    });
  });

  test("applies progression rewards when fishing over HTTP", async () => {
    const response = await requestJson(`/players/${testUserId}/actions/fish`, {
      method: "POST",
      headers: {
        Authorization: getMasterAuthorization(),
      },
    });
    const body = response.json<{
      progression: {
        skills: {
          fishing: { currentXp: number };
        };
        attributes: {
          dexterity: { currentXp: number };
          luck: { currentXp: number };
        };
      };
      resultModifiers: {
        fishingLevel: number;
        categoryProbabilities: {
          fish: number;
          junk: number;
          treasure: number;
        };
        randomEventProbabilities: {
          none: number;
          events: unknown[];
        };
      };
      outcome: "caught" | "no_catch";
      item: null | {
        id: string;
        xpGained: number;
        sellValue: number;
      };
      randomEvent: { occurred: boolean };
      inventory: { added: boolean; itemId: string | null };
    }>();

    if (response.status !== 200) {
      console.log(body);
    }

    expect(response.status).toBe(200);
    expect(body.resultModifiers.fishingLevel).toBe(1);
    expect(body.resultModifiers.categoryProbabilities).toEqual({
      fish: 0.9,
      junk: 0.075,
      treasure: 0.025,
    });
    expect(body.resultModifiers.randomEventProbabilities.events.length).toBeGreaterThan(0);

    if (body.outcome === "caught") {
      if (!body.item) {
        throw new Error("Expected caught fishing action to include item.");
      }

      expect(body.inventory.added).toBe(true);
      expect(body.inventory.itemId).toBe(body.item.id);
      expect(body.item.xpGained).toBeGreaterThan(0);
      expect(body.item.sellValue).toBeGreaterThanOrEqual(0);
      expect(body.progression.skills.fishing.currentXp).toBe(body.item.xpGained);
      expect(body.progression.attributes.dexterity.currentXp).toBeGreaterThan(0);
      expect(body.progression.attributes.luck.currentXp).toBeGreaterThan(0);
    } else {
      expect(body.inventory.added).toBe(false);
      expect(body.inventory.itemId).toBeNull();
    }
  });

  test("returns fishing probabilities over HTTP", async () => {
    const response = await requestJson(`/players/${testUserId}/actions/fish/probabilities`, {
      method: "GET",
      headers: {
        Authorization: getMasterAuthorization(),
      },
    });
    const body = response.json<{
      probabilities: {
        categoryProbabilities: { fish: number; junk: number; treasure: number };
        drops: { fish: unknown[]; treasure: unknown[]; junk: unknown[] };
        fishQualities: unknown[];
        randomEvents: { none: number; events: unknown[] };
      };
    }>();

    expect(response.status).toBe(200);
    expect(body.probabilities.categoryProbabilities).toEqual({
      fish: 0.9,
      junk: 0.075,
      treasure: 0.025,
    });
    expect(body.probabilities.drops.fish).toHaveLength(14);
    expect(body.probabilities.drops.treasure).toHaveLength(8);
    expect(body.probabilities.drops.junk).toHaveLength(8);
    expect(body.probabilities.fishQualities).toHaveLength(6);
    expect(body.probabilities.randomEvents.events).toHaveLength(20);
    expect(body.probabilities.randomEvents.none).toBeGreaterThanOrEqual(0);
  });
});
