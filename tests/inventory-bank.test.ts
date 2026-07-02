import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

const testDatabasePath = "/tmp/chat-rpg-tests.sqlite";

type DatabaseClientModule = typeof import("../src/database/client");
type DatabaseSetupModule = typeof import("../src/database/setup");
type DatabaseSchemaModule = typeof import("../src/database/schema");
type InventoryServiceModule = typeof import("../src/modules/inventory/inventory.service");
type BankServiceModule = typeof import("../src/modules/bank/bank.service");

let databaseClient: DatabaseClientModule;
let databaseSetup: DatabaseSetupModule;
let schema: DatabaseSchemaModule;
let inventoryService: InventoryServiceModule;
let bankService: BankServiceModule;

const stackableItemId = "test_stackable_fish";
const nonStackableItemId = "test_bronze_sword";
const testUserId = 1;
const testUsername = "inventory-bank-test-user";

beforeAll(async () => {
  process.env.DATABASE_PATH = testDatabasePath;
  process.env.JWT_SECRET = "temporary-secret-for-inventory-bank-tests";
  process.env.MASTER_PASSWORD = "test-master-password";
  process.env.LOG_LEVEL = "silent";

  databaseClient = await import("../src/database/client");
  databaseSetup = await import("../src/database/setup");
  schema = await import("../src/database/schema");
  inventoryService = await import("../src/modules/inventory/inventory.service");
  bankService = await import("../src/modules/bank/bank.service");

  databaseSetup.initializeDatabase();
});

afterAll(() => {
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
  databaseClient.db.delete(schema.userActionModifiers).run();
  databaseClient.db.delete(schema.userGuildMemberships).run();
  databaseClient.db.delete(schema.guilds).run();
  databaseClient.db.delete(schema.items).run();
  databaseClient.db.delete(schema.users).run();

  createTestUserAndItems();
});

function createTestUserAndItems(): void {
  const now = new Date().toISOString();

  databaseClient.db
    .insert(schema.users)
    .values({
      id: testUserId,
      username: testUsername,
      passwordHash: "test-password-hash",
      role: "player",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  databaseClient.db
    .insert(schema.items)
    .values([
      {
        id: stackableItemId,
        name: "Peixe de teste",
        description: "Item stackable usado apenas nos testes.",
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
      },
      {
        id: nonStackableItemId,
        name: "Espada de teste",
        description: "Item non-stackable usado apenas nos testes.",
        category: "equipment",
        type: "weapon",
        rarity: "common",
        stackable: false,
        maxStack: null,
        baseValue: 10,
        metadata: "{}",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ])
    .run();

  const user = databaseClient.db.select().from(schema.users).all()[0];

  if (!user) {
    throw new Error("Failed to create test user.");
  }

  expect(user.id).toBe(testUserId);
  expect(user.username).toBe(testUsername);

  return undefined;
}

describe("inventory and bank", () => {
  describe("inventory", () => {
    test("starts with 10 slots", async () => {
      await expect(inventoryService.getInventorySlotLimit(testUserId)).resolves.toBe(10);
    });

    test("stacks stackable items into one inventory slot", async () => {
      await inventoryService.addItemToInventory(testUserId, stackableItemId, 3);
      await inventoryService.addItemToInventory(testUserId, stackableItemId, 2);

      const inventoryItems = await inventoryService.listInventoryItems(testUserId);

      expect(inventoryItems).toHaveLength(1);
      expect(inventoryItems[0]).toMatchObject({
        itemId: stackableItemId,
        quantity: 5,
      });
    });

    test("keeps non-stackable items in separate inventory slots", async () => {
      const addResult = await inventoryService.addItemToInventory(testUserId, nonStackableItemId, 3);
      const inventoryItems = await inventoryService.listInventoryItems(testUserId);

      expect(addResult.added).toBe(true);
      expect(inventoryItems).toHaveLength(3);
      expect(inventoryItems.every((item) => item.itemId === nonStackableItemId)).toBe(true);
      expect(inventoryItems.every((item) => item.quantity === 1)).toBe(true);
    });

    test("does not add a new item when inventory is full", async () => {
      await inventoryService.addItemToInventory(testUserId, nonStackableItemId, 10);

      const addResult = await inventoryService.addItemToInventory(testUserId, nonStackableItemId, 1);
      const inventoryItems = await inventoryService.listInventoryItems(testUserId);

      expect(addResult).toEqual({
        added: false,
        reason: "inventory_full",
        itemId: nonStackableItemId,
        quantity: 1,
        occupiedSlots: 10,
        maxSlots: 10,
      });
      expect(inventoryItems).toHaveLength(10);
    });
  });

  describe("bank deposits", () => {
    test("moves stackable items from inventory to bank", async () => {
      await inventoryService.addItemToInventory(testUserId, stackableItemId, 8);

      const deposited = await bankService.depositInventoryItemToBank(testUserId, stackableItemId, 3);
      const inventoryItems = await inventoryService.listInventoryItems(testUserId);
      const bankItems = await bankService.listBankItems(testUserId);

      expect(deposited).toBe(true);
      expect(inventoryItems).toHaveLength(1);
      expect(inventoryItems[0]).toMatchObject({
        itemId: stackableItemId,
        quantity: 5,
      });
      expect(bankItems).toHaveLength(1);
      expect(bankItems[0]).toMatchObject({
        itemId: stackableItemId,
        quantity: 3,
      });
    });

    test("moves non-stackable items from inventory to bank", async () => {
      await inventoryService.addItemToInventory(testUserId, nonStackableItemId, 2);

      const deposited = await bankService.depositInventoryItemToBank(
        testUserId,
        nonStackableItemId,
        2,
      );
      const inventoryItems = await inventoryService.listInventoryItems(testUserId);
      const bankItems = await bankService.listBankItems(testUserId);

      expect(deposited).toBe(true);
      expect(inventoryItems).toHaveLength(0);
      expect(bankItems).toHaveLength(2);
      expect(bankItems.every((item) => item.itemId === nonStackableItemId)).toBe(true);
      expect(bankItems.every((item) => item.quantity === 1)).toBe(true);
    });

    test("does not deposit items the user does not have", async () => {
      const deposited = await bankService.depositInventoryItemToBank(testUserId, stackableItemId, 1);

      expect(deposited).toBe(false);
      await expect(inventoryService.listInventoryItems(testUserId)).resolves.toHaveLength(0);
      await expect(bankService.listBankItems(testUserId)).resolves.toHaveLength(0);
    });
  });

  describe("bank withdrawals", () => {
    test("moves stackable items from bank to inventory", async () => {
      await bankService.addItemToBank(testUserId, stackableItemId, 10);

      const withdrawn = await bankService.withdrawBankItemToInventory(testUserId, stackableItemId, 4);
      const inventoryItems = await inventoryService.listInventoryItems(testUserId);
      const bankItems = await bankService.listBankItems(testUserId);

      expect(withdrawn).toBe(true);
      expect(inventoryItems).toHaveLength(1);
      expect(inventoryItems[0]).toMatchObject({
        itemId: stackableItemId,
        quantity: 4,
      });
      expect(bankItems).toHaveLength(1);
      expect(bankItems[0]).toMatchObject({
        itemId: stackableItemId,
        quantity: 6,
      });
    });

    test("moves non-stackable items from bank to inventory", async () => {
      await bankService.addItemToBank(testUserId, nonStackableItemId, 2);

      const withdrawn = await bankService.withdrawBankItemToInventory(
        testUserId,
        nonStackableItemId,
        2,
      );
      const inventoryItems = await inventoryService.listInventoryItems(testUserId);
      const bankItems = await bankService.listBankItems(testUserId);

      expect(withdrawn).toBe(true);
      expect(inventoryItems).toHaveLength(2);
      expect(inventoryItems.every((item) => item.itemId === nonStackableItemId)).toBe(true);
      expect(bankItems).toHaveLength(0);
    });

    test("keeps bank unchanged when withdrawing into a full inventory", async () => {
      await inventoryService.addItemToInventory(testUserId, nonStackableItemId, 10);
      await bankService.addItemToBank(testUserId, nonStackableItemId, 1);

      const withdrawn = await bankService.withdrawBankItemToInventory(
        testUserId,
        nonStackableItemId,
        1,
      );
      const inventoryItems = await inventoryService.listInventoryItems(testUserId);
      const bankItems = await bankService.listBankItems(testUserId);

      expect(withdrawn).toBe(false);
      expect(inventoryItems).toHaveLength(10);
      expect(bankItems).toHaveLength(1);
      expect(bankItems[0]).toMatchObject({
        itemId: nonStackableItemId,
        quantity: 1,
      });
    });
  });

  describe("inventory slot bonuses", () => {
    test("expands inventory capacity", async () => {
      await inventoryService.setInventorySlotBonus(testUserId, "equipment:test_backpack", 2);

      await expect(inventoryService.getInventorySlotLimit(testUserId)).resolves.toBe(12);
    });

    test("allows new items after capacity is expanded", async () => {
      await inventoryService.addItemToInventory(testUserId, nonStackableItemId, 10);

      expect(await inventoryService.addItemToInventory(testUserId, nonStackableItemId, 1)).toMatchObject({
      added: false,
      reason: "inventory_full",
    });

      await inventoryService.setInventorySlotBonus(testUserId, "equipment:test_backpack", 2);

      expect(await inventoryService.addItemToInventory(testUserId, nonStackableItemId, 2)).toMatchObject({
        added: true,
      });

      await expect(inventoryService.listInventoryItems(testUserId)).resolves.toHaveLength(12);
    });
  });
});
