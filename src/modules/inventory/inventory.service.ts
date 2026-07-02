import { db } from "../../database/client";
import type { UserInventoryItemRow } from "../../database/schema";
import { getActiveItemOrThrow } from "../items/items.service";
import { InventoryRepository } from "./inventory.repository";

const BASE_INVENTORY_SLOTS = 10;

const inventoryRepository = new InventoryRepository(db);

export type AddInventoryItemResult =
  | {
      added: true;
      itemId: string;
      quantity: number;
      occupiedSlots: number;
      maxSlots: number;
    }
  | {
      added: false;
      reason: "inventory_full";
      itemId: string;
      quantity: number;
      occupiedSlots: number;
      maxSlots: number;
    };

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer.");
  }
}

export async function getInventorySlotLimit(userId: number): Promise<number> {
  const bonusSlots = await inventoryRepository.sumBonusSlots(userId);

  return BASE_INVENTORY_SLOTS + bonusSlots;
}

export async function setInventorySlotBonus(
  userId: number,
  source: string,
  slots: number,
): Promise<void> {
  if (!Number.isInteger(slots)) {
    throw new Error("Slots must be an integer.");
  }

  const now = new Date().toISOString();
  await inventoryRepository.setSlotBonus({
    userId,
    source,
    slots,
    createdAt: now,
    updatedAt: now,
  });
}

export async function addItemToInventory(
  userId: number,
  itemId: string,
  quantity = 1,
  metadata?: unknown,
): Promise<AddInventoryItemResult> {
  assertPositiveQuantity(quantity);

  const item = await getActiveItemOrThrow(itemId);
  const maxSlots = await getInventorySlotLimit(userId);
  const occupiedSlots = await inventoryRepository.countOccupiedSlots(userId);
  const serializedMetadata = metadata === undefined ? null : JSON.stringify(metadata);

  if (serializedMetadata !== null) {
    if (occupiedSlots + quantity > maxSlots) {
      return {
        added: false,
        reason: "inventory_full",
        itemId,
        quantity,
        occupiedSlots,
        maxSlots,
      };
    }

    const now = new Date().toISOString();
    await inventoryRepository.createMany(
      Array.from({ length: quantity }, () => ({
        userId,
        itemId,
        quantity: 1,
        metadata: serializedMetadata,
        createdAt: now,
        updatedAt: now,
      })),
    );

    return {
      added: true,
      itemId,
      quantity,
      occupiedSlots: occupiedSlots + quantity,
      maxSlots,
    };
  }

  if (item.stackable) {
    const existingStack = await inventoryRepository.findStack(userId, itemId);

    if (existingStack) {
      await inventoryRepository.increaseQuantity(existingStack.id, quantity, new Date().toISOString());

      return {
        added: true,
        itemId,
        quantity,
        occupiedSlots,
        maxSlots,
      };
    }

    if (occupiedSlots >= maxSlots) {
      return {
        added: false,
        reason: "inventory_full",
        itemId,
        quantity,
        occupiedSlots,
        maxSlots,
      };
    }

    const now = new Date().toISOString();
    await inventoryRepository.create({
      userId,
      itemId,
      quantity,
      metadata: serializedMetadata,
      createdAt: now,
      updatedAt: now,
    });

    return {
      added: true,
      itemId,
      quantity,
      occupiedSlots: occupiedSlots + 1,
      maxSlots,
    };
  }

  if (occupiedSlots + quantity > maxSlots) {
    return {
      added: false,
      reason: "inventory_full",
      itemId,
      quantity,
      occupiedSlots,
      maxSlots,
    };
  }

  const now = new Date().toISOString();
  await inventoryRepository.createMany(
    Array.from({ length: quantity }, () => ({
      userId,
      itemId,
      quantity: 1,
      metadata: serializedMetadata,
      createdAt: now,
      updatedAt: now,
    })),
  );

  return {
    added: true,
    itemId,
    quantity,
    occupiedSlots: occupiedSlots + quantity,
    maxSlots,
  };
}

export async function listInventoryItems(userId: number): Promise<UserInventoryItemRow[]> {
  return inventoryRepository.listByUserId(userId);
}

export async function removeItemFromInventory(
  userId: number,
  itemId: string,
  quantity = 1,
): Promise<boolean> {
  assertPositiveQuantity(quantity);

  const item = await getActiveItemOrThrow(itemId);
  const inventoryItems = await inventoryRepository.findItems(userId, itemId);

  if (item.stackable) {
    const stack = inventoryItems.find((inventoryItem) => inventoryItem.metadata === null);

    if (!stack || stack.quantity < quantity) {
      return false;
    }

    if (stack.quantity === quantity) {
      await inventoryRepository.deleteById(stack.id);
      return true;
    }

    await inventoryRepository.decreaseQuantity(stack.id, quantity, new Date().toISOString());
    return true;
  }

  if (inventoryItems.length < quantity) {
    return false;
  }

  for (const inventoryItem of inventoryItems.slice(0, quantity)) {
    await inventoryRepository.deleteById(inventoryItem.id);
  }

  return true;
}
