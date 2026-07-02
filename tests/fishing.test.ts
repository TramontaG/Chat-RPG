import { beforeAll, beforeEach, describe, expect, test } from "bun:test";

const testDatabasePath = "/tmp/chat-rpg-fishing-tests.sqlite";
const testUserId = 20;

type DatabaseClientModule = typeof import("../src/database/client");
type DatabaseSetupModule = typeof import("../src/database/setup");
type DatabaseSchemaModule = typeof import("../src/database/schema");
type FishingServiceModule = typeof import("../src/modules/fishing/fishing.service");

let databaseClient: DatabaseClientModule;
let databaseSetup: DatabaseSetupModule;
let schema: DatabaseSchemaModule;
let fishingService: FishingServiceModule;

beforeAll(async () => {
  process.env.DATABASE_PATH = testDatabasePath;
  process.env.JWT_SECRET = "temporary-secret-for-fishing-tests";
  process.env.MASTER_PASSWORD = "test-master-password";
  process.env.LOG_LEVEL = "silent";

  databaseClient = await import("../src/database/client");
  databaseSetup = await import("../src/database/setup");
  schema = await import("../src/database/schema");
  fishingService = await import("../src/modules/fishing/fishing.service");

  databaseSetup.initializeDatabase();
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
    WHERE id = ${testUserId} OR username = 'fishing-test-user';
  `);

  const now = new Date().toISOString();
  databaseClient.db
    .insert(schema.users)
    .values({
      id: testUserId,
      username: "fishing-test-user",
      passwordHash: "test-password-hash",
      role: "player",
      createdAt: now,
      updatedAt: now,
    })
    .run();
});

describe("fishing", () => {
  test("seeds fishing table items into the items table during database initialization", () => {
    databaseSetup.initializeDatabase();

    const fishingItems = databaseClient.db
      .select()
      .from(schema.items)
      .all()
      .filter((item) => item.metadata.includes('"source":"fishing"'));

    expect(fishingItems).toHaveLength(30);
    expect(fishingItems.map((item) => item.id).sort()).toContain("fishing_fish_lambari");
    expect(fishingItems.map((item) => item.id).sort()).toContain("fishing_treasure_bau_pequeno");
    expect(fishingItems.map((item) => item.id).sort()).toContain("fishing_junk_alga");
  });

  test("uses baseline category probabilities at luck level 1", () => {
    expect(fishingService.calculateFishingCategoryProbabilities(1)).toEqual({
      fish: 0.9,
      junk: 0.075,
      treasure: 0.025,
    });
  });

  test("luck shifts probability away from junk and toward treasure without making junk impossible", () => {
    const lowLuck = fishingService.calculateFishingCategoryProbabilities(1);
    const highLuck = fishingService.calculateFishingCategoryProbabilities(100);

    expect(highLuck.junk).toBeGreaterThan(0);
    expect(highLuck.junk).toBeLessThan(lowLuck.junk);
    expect(highLuck.treasure).toBeGreaterThan(lowLuck.treasure);
    expect(highLuck.fish + highLuck.junk + highLuck.treasure).toBeCloseTo(1, 10);
  });

  test("drop weights stay non-zero even when player level is far from target level", () => {
    const weight = fishingService.calculateFishingDropWeight(
      {
        item: "Impossible-looking item",
        targetLevel: 100,
        baseWeight: 0.01,
        xp: 1,
        sellValue: 1,
      },
      {
        fishingLevel: 1,
        dexterityLevel: 1,
        luckLevel: 1,
      },
    );

    expect(weight).toBeGreaterThan(0);
  });

  test("adds a caught fish with catch metadata and progression rewards", async () => {
    const rngValues = [0.1, 0.1, 0.4, 0.5];
    const result = await fishingService.performFishingAction(testUserId, () => rngValues.shift() ?? 0.5);
    const inventoryItems = databaseClient.db
      .select()
      .from(schema.userInventoryItems)
      .all();

    expect(result.category).toBe("fish");
    expect(result.inventory.added).toBe(true);
    expect(result.quality).not.toBeNull();
    expect(result.fishWeight).not.toBeNull();
    expect(result.progression.skills.fishing?.currentXp).toBe(result.item.xpGained);
    expect(inventoryItems).toHaveLength(1);

    const metadata = JSON.parse(inventoryItems[0]?.metadata ?? "{}") as {
      source?: string;
      category?: string;
      sellValue?: number;
      quality?: string;
    };

    expect(metadata.source).toBe("fishing");
    expect(metadata.category).toBe("fish");
    expect(metadata.sellValue).toBe(result.item.sellValue);
    expect(metadata.quality).toBe(result.quality?.value);
  });
});
