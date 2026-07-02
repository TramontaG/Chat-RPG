import { beforeAll, beforeEach, describe, expect, test } from "bun:test";

const testDatabasePath = "/tmp/chat-rpg-tests.sqlite";
const testUserId = 10;

type DatabaseClientModule = typeof import("../src/database/client");
type DatabaseSetupModule = typeof import("../src/database/setup");
type DatabaseSchemaModule = typeof import("../src/database/schema");
type ProgressionServiceModule = typeof import("../src/modules/progression/progression.service");

let databaseClient: DatabaseClientModule;
let databaseSetup: DatabaseSetupModule;
let schema: DatabaseSchemaModule;
let progressionService: ProgressionServiceModule;

beforeAll(async () => {
  process.env.DATABASE_PATH = testDatabasePath;
  process.env.JWT_SECRET = "temporary-secret-for-progression-tests";
  process.env.MASTER_PASSWORD = "test-master-password";
  process.env.LOG_LEVEL = "silent";

  databaseClient = await import("../src/database/client");
  databaseSetup = await import("../src/database/setup");
  schema = await import("../src/database/schema");
  progressionService = await import("../src/modules/progression/progression.service");

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
  databaseClient.sqlite.exec(`
    DELETE FROM users
    WHERE id = ${testUserId} OR username = 'progression-test-user';
  `);

  const now = new Date().toISOString();
  databaseClient.db
    .insert(schema.users)
    .values({
      id: testUserId,
      username: "progression-test-user",
      passwordHash: "test-password-hash",
      role: "player",
      createdAt: now,
      updatedAt: now,
    })
    .run();
});

describe("progression", () => {
  test("seeds cumulative level requirements with an increasing multiplier", () => {
    const requirements = databaseClient.db
      .select()
      .from(schema.progressionLevelRequirements)
      .all()
      .sort((first, second) => first.level - second.level);

    expect(requirements).toHaveLength(100);
    expect(requirements[0]).toMatchObject({
      level: 1,
      xpRequired: 0,
      multiplier: 1,
    });
    expect(requirements[1]).toMatchObject({
      level: 2,
      xpRequired: 100,
    });
    expect(requirements[1]?.multiplier).toBeGreaterThanOrEqual(1.05);
    expect(requirements[99]).toMatchObject({
      level: 100,
      xpRequired: 40697,
      multiplier: 1.08,
    });

    for (let index = 2; index < requirements.length; index += 1) {
      expect(requirements[index]?.xpRequired).toBeGreaterThan(requirements[index - 1]?.xpRequired ?? 0);
      expect(requirements[index]?.multiplier).toBeGreaterThanOrEqual(requirements[index - 1]?.multiplier ?? 0);
    }
  });

  test("initializes all attributes and skills for a user", async () => {
    const progression = await progressionService.getUserProgression(testUserId);

    expect(progression.attributes.map((attribute) => attribute.attribute).sort()).toEqual([
      "dexterity",
      "intelligence",
      "luck",
      "strength",
      "vitality",
    ]);
    expect(progression.skills.map((skill) => skill.skill).sort()).toEqual([
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
    expect(progression.attributes.every((attribute) => attribute.level === 1 && attribute.xp === 0)).toBe(true);
    expect(progression.attributePoints).toMatchObject({
      userId: testUserId,
      availablePoints: 0,
      totalEarned: 0,
      totalSpent: 0,
    });
    expect(progression.skills.every((skill) => skill.level === 1 && skill.xp === 0)).toBe(true);
    expect(progression.skills.every((skill) => skill.xpForCurrentLevel === 0)).toBe(true);
    expect(progression.skills.every((skill) => skill.xpForNextLevel === 100)).toBe(true);
    expect(progression.skills.every((skill) => skill.xpRemainingToNextLevel === 100)).toBe(true);
  });

  test("keeps skill at current level below the next level requirement", async () => {
    const grant = await progressionService.grantSkillXp(testUserId, "fishing", 99);

    expect(grant).toMatchObject({
      xpGained: 99,
      previousXp: 0,
      currentXp: 99,
      previousLevel: 1,
      currentLevel: 1,
      leveledUp: false,
      xpForCurrentLevel: 0,
      xpForNextLevel: 100,
      xpRemainingToNextLevel: 1,
    });
  });

  test("levels up skill when xp reaches the next requirement", async () => {
    await progressionService.grantSkillXp(testUserId, "fishing", 99);
    const grant = await progressionService.grantSkillXp(testUserId, "fishing", 1);

    expect(grant).toMatchObject({
      xpGained: 1,
      previousXp: 99,
      currentXp: 100,
      previousLevel: 1,
      currentLevel: 2,
      leveledUp: true,
      xpForCurrentLevel: 100,
      xpForNextLevel: 106,
      xpRemainingToNextLevel: 6,
    });
  });

  test("grants attribute points for each obtained skill level", async () => {
    await progressionService.grantSkillXp(testUserId, "fishing", 145);
    const grant = await progressionService.grantSkillXp(testUserId, "fishing", 8);
    const progression = await progressionService.getUserProgression(testUserId);

    expect(grant.currentLevel).toBe(10);
    expect(grant.attributePointsGained).toBe(5);
    expect(progression.attributePoints).toMatchObject({
      availablePoints: 25,
      totalEarned: 25,
      totalSpent: 0,
    });
  });

  test("spends attribute points using the target attribute level as cost", async () => {
    await progressionService.grantSkillXp(testUserId, "fishing", 153);

    const spend = await progressionService.spendAttributePoints(testUserId, "dexterity", 2);
    const progression = await progressionService.getUserProgression(testUserId);
    const dexterity = progression.attributes.find((attribute) => attribute.attribute === "dexterity");

    expect(spend).toMatchObject({
      attribute: "dexterity",
      levelsPurchased: 2,
      previousLevel: 1,
      currentLevel: 3,
      cost: 5,
    });
    expect(spend.attributePoints).toMatchObject({
      availablePoints: 20,
      totalEarned: 25,
      totalSpent: 5,
    });
    expect(dexterity?.level).toBe(3);
    expect(progression.attributePoints.availablePoints).toBe(20);
  });

  test("applies action rewards across attributes and skills", async () => {
    const rewards = await progressionService.applyActionProgressionRewards(testUserId, {
      skills: {
        fishing: 25,
      },
      attributes: {
        dexterity: 5,
        luck: 2,
      },
    });

    expect(rewards.skills.fishing?.currentXp).toBe(25);
    expect(rewards.skills.fishing?.currentLevel).toBe(1);
    expect(rewards.skills.fishing?.xpRemainingToNextLevel).toBe(75);
    expect(rewards.attributes.dexterity?.currentXp).toBe(5);
    expect(rewards.attributes.luck?.currentXp).toBe(2);
  });
});
