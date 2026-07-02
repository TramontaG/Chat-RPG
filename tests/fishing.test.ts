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
  databaseClient.db.delete(schema.userActionModifiers).run();
  databaseClient.db.delete(schema.userGuildMemberships).run();
  databaseClient.db.delete(schema.guilds).run();
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

function addBaitToInventory(itemId = "bait_basic_worm", quantity = 1): void {
  databaseSetup.initializeDatabase();
  const now = new Date().toISOString();

  databaseClient.db
    .insert(schema.userInventoryItems)
    .values({
      userId: testUserId,
      itemId,
      quantity,
      metadata: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

function getRandomEventRoll(eventId: string): number {
  const probabilities = fishingService.calculateFishingRandomEventProbabilities(1);
  let cumulative = probabilities.none;
  const event = probabilities.events.find((candidate) => candidate.id === eventId);

  if (!event) {
    throw new Error(`Missing random event: ${eventId}`);
  }

  for (const candidate of probabilities.events) {
    if (candidate.id === eventId) {
      break;
    }

    cumulative += candidate.rollProbability;
  }

  return cumulative + event.rollProbability / 2;
}

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

  test("calculates random event probability with luck scaling", () => {
    const probabilities = fishingService.calculateFishingRandomEventProbabilities(15);
    const lineSnapped = probabilities.events.find((event) => event.id === "line_snapped");
    const bonusBait = probabilities.events.find((event) => event.id === "bonus_bait");

    expect(lineSnapped?.effectiveChance).toBeCloseTo(0.0395, 8);
    expect(bonusBait?.effectiveChance).toBeCloseTo(0.145, 8);
    expect(probabilities.none).toBeGreaterThanOrEqual(0);
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
    addBaitToInventory();
    const rngValues = [0.1, 0.1, 0.4, 0.5];
    const result = await fishingService.performFishingAction(testUserId, {}, () => rngValues.shift() ?? 0.5);
    const inventoryItems = databaseClient.db
      .select()
      .from(schema.userInventoryItems)
      .all();

    expect(result.category).toBe("fish");
    expect(result.outcome).toBe("caught");
    expect(result.item).not.toBeNull();
    expect(result.inventory.added).toBe(true);
    expect(result.quality).not.toBeNull();
    expect(result.fishWeight).not.toBeNull();
    expect(result.progression.skills.fishing?.currentXp).toBe(result.item?.xpGained);
    expect(inventoryItems.filter((item) => item.itemId !== "bait_basic_worm")).toHaveLength(1);

    const caughtItem = inventoryItems.find((item) => item.itemId !== "bait_basic_worm");
    const metadata = JSON.parse(caughtItem?.metadata ?? "{}") as {
      source?: string;
      category?: string;
      sellValue?: number;
      quality?: string;
    };

    expect(metadata.source).toBe("fishing");
    expect(metadata.category).toBe("fish");
    expect(metadata.sellValue).toBe(result.item?.sellValue);
    expect(metadata.quality).toBe(result.quality?.value);
  });

  test("can apply a bad random event that prevents the catch", async () => {
    addBaitToInventory();
    const probabilities = fishingService.calculateFishingRandomEventProbabilities(1);
    let cumulative = probabilities.none;
    const lineSnapped = probabilities.events.find((event) => event.id === "line_snapped");

    if (!lineSnapped) {
      throw new Error("Missing line_snapped random event.");
    }

    for (const event of probabilities.events) {
      if (event.id === "line_snapped") {
        break;
      }

      cumulative += event.rollProbability;
    }

    const rngValues = [cumulative + lineSnapped.rollProbability / 2, 0.1, 0.1];
    const result = await fishingService.performFishingAction(testUserId, {}, () => rngValues.shift() ?? 0.5);
    const inventoryItems = databaseClient.db.select().from(schema.userInventoryItems).all();

    expect(result.outcome).toBe("no_catch");
    expect(result.item).toBeNull();
    expect(result.inventory).toMatchObject({
      added: false,
      reason: "no_catch",
    });
    expect(result.randomEvent).toMatchObject({
      occurred: true,
      event: {
        id: "line_snapped",
        effectApplied: true,
      },
    });
    expect(inventoryItems).toHaveLength(0);
  });

  test("requires bait selection when multiple bait types are in inventory", async () => {
    addBaitToInventory("bait_basic_worm", 1);
    addBaitToInventory("bait_golden_corn", 1);
    const rngValues = [0.1, 0.1, 0.4, 0.5];
    let ambiguousBaitError: Error | null = null;

    try {
      await fishingService.performFishingAction(testUserId);
    } catch (error) {
      ambiguousBaitError = error as Error;
    }

    expect(ambiguousBaitError?.message).toContain("Multiple bait types found");

    const result = await fishingService.performFishingAction(
      testUserId,
      { baitName: "Milho Dourado" },
      () => rngValues.shift() ?? 0.5,
    );

    expect(result.bait).toMatchObject({
      itemId: "bait_golden_corn",
      consumed: 1,
    });
  });

  test("persists and consumes next-fishing modifiers from random events", async () => {
    addBaitToInventory("bait_basic_worm", 2);
    const favorableCurrentRoll = getRandomEventRoll("favorable_current");
    const firstRngValues = [favorableCurrentRoll, 0.1, 0.1, 0.4, 0.5];
    const firstResult = await fishingService.performFishingAction(
      testUserId,
      {},
      () => firstRngValues.shift() ?? 0.5,
    );
    const probabilitiesWithModifier = await fishingService.getFishingProbabilities(testUserId);

    expect(firstResult.randomEvent).toMatchObject({
      occurred: true,
      event: {
        id: "favorable_current",
        effectApplied: true,
      },
    });
    expect(firstResult.actionModifiers.created).toHaveLength(1);
    expect(probabilitiesWithModifier.activeModifiers).toHaveLength(1);
    expect(probabilitiesWithModifier.categoryProbabilities.fish).toBeGreaterThan(0.9);

    const secondRngValues = [0.1, 0.1, 0.1, 0.4, 0.5];
    const secondResult = await fishingService.performFishingAction(
      testUserId,
      {},
      () => secondRngValues.shift() ?? 0.5,
    );
    const probabilitiesAfterConsumption = await fishingService.getFishingProbabilities(testUserId);

    expect(secondResult.actionModifiers.applied).toHaveLength(1);
    expect(probabilitiesAfterConsumption.activeModifiers).toHaveLength(0);
  });
});
