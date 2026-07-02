import { getItemOrThrow, upsertItemDefinition } from "../items/items.service";
import {
  addItemToInventory,
  getInventorySlotOrThrow,
  removeInventorySlotQuantity,
} from "../inventory/inventory.service";
import { addGoldToBank, getUserBank, spendGoldFromBank } from "../bank/bank.service";
import { BAIT_DEFINITIONS, buildBaitItemDefinitions } from "./bait.items";

export type SellInventorySlotResult = {
  sold: true;
  userId: number;
  inventorySlotId: number;
  itemId: string;
  quantity: number;
  unitValue: number;
  goldGained: number;
  bank: Awaited<ReturnType<typeof getUserBank>>;
};

export type BuyBaitResult = {
  bought: true;
  userId: number;
  itemId: string;
  quantity: number;
  unitPrice: number;
  goldSpent: number;
  bank: Awaited<ReturnType<typeof getUserBank>>;
};

export class ItemIsNotBaitError extends Error {
  constructor(itemId: string) {
    super(`Item is not bait: ${itemId}`);
    this.name = "ItemIsNotBaitError";
  }
}

export function listBaitShopItems() {
  return BAIT_DEFINITIONS;
}

async function ensureBaitItemDefinitions(): Promise<void> {
  await Promise.all(buildBaitItemDefinitions().map(upsertItemDefinition));
}

function getBaitBuyPrice(metadata: string, fallback = 1): number {
  const parsedMetadata = JSON.parse(metadata) as { shop?: { buyPrice?: unknown } };

  if (typeof parsedMetadata.shop?.buyPrice === "number" && Number.isFinite(parsedMetadata.shop.buyPrice)) {
    return Math.max(1, Math.floor(parsedMetadata.shop.buyPrice));
  }

  return fallback;
}

function getSlotSellValue(metadata: string | null, baseValue: number): number {
  if (!metadata) {
    return baseValue;
  }

  const parsedMetadata = JSON.parse(metadata) as { sellValue?: unknown };

  if (typeof parsedMetadata.sellValue === "number" && Number.isFinite(parsedMetadata.sellValue)) {
    return Math.max(0, Math.floor(parsedMetadata.sellValue));
  }

  return baseValue;
}

export async function sellInventorySlotToGame(
  userId: number,
  inventorySlotId: number,
  quantity = 1,
): Promise<SellInventorySlotResult | null> {
  const slot = await getInventorySlotOrThrow(userId, inventorySlotId);
  const item = await getItemOrThrow(slot.itemId);

  if (slot.quantity < quantity) {
    return null;
  }

  const unitValue = getSlotSellValue(slot.metadata, item.baseValue);
  const goldGained = unitValue * quantity;
  const removedSlot = await removeInventorySlotQuantity(userId, inventorySlotId, quantity);

  if (!removedSlot) {
    return null;
  }

  if (goldGained > 0) {
    await addGoldToBank(userId, goldGained);
  }

  return {
    sold: true,
    userId,
    inventorySlotId,
    itemId: slot.itemId,
    quantity,
    unitValue,
    goldGained,
    bank: await getUserBank(userId),
  };
}

export async function buyBaitFromShop(
  userId: number,
  baitItemId: string,
  quantity = 1,
): Promise<BuyBaitResult> {
  await ensureBaitItemDefinitions();
  const item = await getItemOrThrow(baitItemId);

  if (item.type !== "bait") {
    throw new ItemIsNotBaitError(baitItemId);
  }

  const unitPrice = getBaitBuyPrice(item.metadata, Math.max(1, item.baseValue));
  const goldSpent = unitPrice * quantity;

  await spendGoldFromBank(userId, goldSpent);

  const addResult = await addItemToInventory(userId, baitItemId, quantity);

  if (!addResult.added) {
    await addGoldToBank(userId, goldSpent);
    throw new Error("Failed to add bait to inventory.");
  }

  return {
    bought: true,
    userId,
    itemId: baitItemId,
    quantity,
    unitPrice,
    goldSpent,
    bank: await getUserBank(userId),
  };
}
