import { db } from "../../database/client";
import type { UserActionModifierRow } from "../../database/schema";
import { ActionModifiersRepository } from "./action-modifiers.repository";

const actionModifiersRepository = new ActionModifiersRepository(db);

export type CreateActionModifierInput = {
  userId: number;
  source: string;
  action: string;
  modifierType: string;
  payload?: unknown;
  remainingUses?: number;
  expiresAt?: string | null;
};

export async function listActiveActionModifiers(
  userId: number,
  action: string,
): Promise<UserActionModifierRow[]> {
  return actionModifiersRepository.listActive(userId, action, new Date().toISOString());
}

export async function createActionModifier(
  input: CreateActionModifierInput,
): Promise<UserActionModifierRow> {
  const now = new Date().toISOString();

  return actionModifiersRepository.create({
    userId: input.userId,
    source: input.source,
    action: input.action,
    modifierType: input.modifierType,
    payload: JSON.stringify(input.payload ?? {}),
    remainingUses: input.remainingUses ?? 1,
    expiresAt: input.expiresAt ?? null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function consumeActionModifiers(
  modifiers: UserActionModifierRow[],
): Promise<void> {
  const now = new Date().toISOString();

  await Promise.all(modifiers.map((modifier) => actionModifiersRepository.decrementUses(modifier.id, now)));
}
