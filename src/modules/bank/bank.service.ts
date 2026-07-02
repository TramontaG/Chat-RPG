import { db } from "../../database/client";
import type { UserBankItemRow, UserBankRow } from "../../database/schema";
import { addItemToInventory, removeItemFromInventory } from "../inventory/inventory.service";
import { getActiveItemOrThrow } from "../items/items.service";
import { BankRepository } from "./bank.repository";

const bankRepository = new BankRepository(db);

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer.");
  }
}

async function ensureBank(userId: number): Promise<UserBankRow> {
  const existingBank = await bankRepository.findBank(userId);

  if (existingBank) {
    return existingBank;
  }

  const now = new Date().toISOString();
  await bankRepository.createBank({
    userId,
    gold: 0,
    createdAt: now,
    updatedAt: now,
  });

  const createdBank = await bankRepository.findBank(userId);

  if (!createdBank) {
    throw new Error("Failed to create user bank.");
  }

  return createdBank;
}

export async function getUserBank(userId: number): Promise<UserBankRow> {
  return ensureBank(userId);
}

export async function addGoldToBank(userId: number, amount: number): Promise<void> {
  assertPositiveQuantity(amount);
  await ensureBank(userId);
  await bankRepository.addGold(userId, amount, new Date().toISOString());
}

export async function addItemToBank(userId: number, itemId: string, quantity = 1): Promise<void> {
  assertPositiveQuantity(quantity);

  const item = await getActiveItemOrThrow(itemId);
  await ensureBank(userId);

  if (item.stackable) {
    const existingStack = await bankRepository.findStack(userId, itemId);

    if (existingStack) {
      await bankRepository.increaseItemQuantity(existingStack.id, quantity, new Date().toISOString());
      return;
    }

    const now = new Date().toISOString();
    await bankRepository.createItem({
      userId,
      itemId,
      quantity,
      metadata: null,
      createdAt: now,
      updatedAt: now,
    });
    return;
  }

  const now = new Date().toISOString();
  await bankRepository.createItems(
    Array.from({ length: quantity }, () => ({
      userId,
      itemId,
      quantity: 1,
      metadata: null,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

export async function listBankItems(userId: number): Promise<UserBankItemRow[]> {
  await ensureBank(userId);

  return bankRepository.listItems(userId);
}

export async function removeItemFromBank(
  userId: number,
  itemId: string,
  quantity = 1,
): Promise<boolean> {
  assertPositiveQuantity(quantity);

  const item = await getActiveItemOrThrow(itemId);
  await ensureBank(userId);

  const bankItems = await bankRepository.findItems(userId, itemId);

  if (item.stackable) {
    const stack = bankItems.find((bankItem) => bankItem.metadata === null);

    if (!stack || stack.quantity < quantity) {
      return false;
    }

    if (stack.quantity === quantity) {
      await bankRepository.deleteItemById(stack.id);
      return true;
    }

    await bankRepository.decreaseItemQuantity(stack.id, quantity, new Date().toISOString());
    return true;
  }

  if (bankItems.length < quantity) {
    return false;
  }

  for (const bankItem of bankItems.slice(0, quantity)) {
    await bankRepository.deleteItemById(bankItem.id);
  }

  return true;
}

export async function depositInventoryItemToBank(
  userId: number,
  itemId: string,
  quantity = 1,
): Promise<boolean> {
  const removedFromInventory = await removeItemFromInventory(userId, itemId, quantity);

  if (!removedFromInventory) {
    return false;
  }

  await addItemToBank(userId, itemId, quantity);
  return true;
}

export async function withdrawBankItemToInventory(
  userId: number,
  itemId: string,
  quantity = 1,
): Promise<boolean> {
  const addResult = await addItemToInventory(userId, itemId, quantity);

  if (!addResult.added) {
    return false;
  }

  const removedFromBank = await removeItemFromBank(userId, itemId, quantity);

  if (!removedFromBank) {
    await removeItemFromInventory(userId, itemId, quantity);
    return false;
  }

  return true;
}
