import { db } from "../../database/client";
import type { UserBankItemRow, UserBankRow } from "../../database/schema";
import {
  addItemToInventory,
  getInventorySlotOrThrow,
  removeInventorySlotQuantity,
  removeItemFromInventory,
} from "../inventory/inventory.service";
import { getActiveItemOrThrow } from "../items/items.service";
import { BankRepository } from "./bank.repository";

const bankRepository = new BankRepository(db);

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer.");
  }
}

export class BankSlotNotFoundError extends Error {
  constructor(slotId: number) {
    super(`Bank slot not found: ${slotId}`);
    this.name = "BankSlotNotFoundError";
  }
}

export class InsufficientGoldError extends Error {
  constructor(required: number, available: number) {
    super(`Insufficient gold. Required: ${required}. Available: ${available}.`);
    this.name = "InsufficientGoldError";
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

export async function spendGoldFromBank(userId: number, amount: number): Promise<void> {
  assertPositiveQuantity(amount);
  const bank = await ensureBank(userId);

  if (bank.gold < amount) {
    throw new InsufficientGoldError(amount, bank.gold);
  }

  await bankRepository.spendGold(userId, amount, new Date().toISOString());
}

export async function addItemToBank(
  userId: number,
  itemId: string,
  quantity = 1,
  metadata: string | null = null,
): Promise<void> {
  assertPositiveQuantity(quantity);

  const item = await getActiveItemOrThrow(itemId);
  await ensureBank(userId);

  if (item.stackable && metadata === null) {
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
      metadata,
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
      metadata,
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

export async function getBankSlotOrThrow(userId: number, bankSlotId: number): Promise<UserBankItemRow> {
  await ensureBank(userId);
  const slot = await bankRepository.findItemById(userId, bankSlotId);

  if (!slot) {
    throw new BankSlotNotFoundError(bankSlotId);
  }

  return slot;
}

export async function removeBankSlotQuantity(
  userId: number,
  bankSlotId: number,
  quantity = 1,
): Promise<UserBankItemRow | null> {
  assertPositiveQuantity(quantity);
  await ensureBank(userId);

  const slot = await bankRepository.findItemById(userId, bankSlotId);

  if (!slot || slot.quantity < quantity) {
    return null;
  }

  if (slot.quantity === quantity) {
    await bankRepository.deleteItemById(slot.id);
  } else {
    await bankRepository.decreaseItemQuantity(slot.id, quantity, new Date().toISOString());
  }

  return slot;
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

export async function depositInventorySlotToBank(
  userId: number,
  inventorySlotId: number,
  quantity = 1,
): Promise<boolean> {
  const slot = await removeInventorySlotQuantity(userId, inventorySlotId, quantity);

  if (!slot) {
    return false;
  }

  await addItemToBank(userId, slot.itemId, quantity, slot.metadata);
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

export async function withdrawBankSlotToInventory(
  userId: number,
  bankSlotId: number,
  quantity = 1,
): Promise<boolean> {
  const slot = await getBankSlotOrThrow(userId, bankSlotId);
  const metadata = slot.metadata === null ? undefined : JSON.parse(slot.metadata);
  const addResult = await addItemToInventory(userId, slot.itemId, quantity, metadata);

  if (!addResult.added) {
    return false;
  }

  const removedFromBank = await removeBankSlotQuantity(userId, bankSlotId, quantity);

  if (!removedFromBank) {
    await removeItemFromInventory(userId, slot.itemId, quantity);
    return false;
  }

  return true;
}
