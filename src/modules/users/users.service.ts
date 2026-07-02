import { db, sqlite } from "../../database/client";
import type { NewUserRow, UserRole, UserRow } from "../../database/schema";
import { UsersRepository } from "../../database/repositories/users.repository";
import { hashPassword } from "../../shared/security/password";
import { addGoldToBank } from "../bank/bank.service";
import { ensureUserProgression } from "../progression/progression.service";

const usersRepository = new UsersRepository(db);

export type PublicUser = Omit<UserRow, "passwordHash">;
export type CreateUserInput = {
  username: string;
  password: string;
  role?: UserRole;
};

export type UpdateUserInput = {
  username?: string;
  password?: string;
  role?: UserRole;
};

export class UserNotFoundError extends Error {
  constructor(userId: number) {
    super(`User not found: ${userId}`);
    this.name = "UserNotFoundError";
  }
}

export class UsernameAlreadyExistsError extends Error {
  constructor(username: string) {
    super(`Username already exists: ${username}`);
    this.name = "UsernameAlreadyExistsError";
  }
}

function toPublicUser({ passwordHash: _passwordHash, ...user }: UserRow): PublicUser {
  return user;
}

export async function listUsers(): Promise<PublicUser[]> {
  const users = await usersRepository.findAll();

  return users.map(toPublicUser);
}

export async function getUser(userId: number): Promise<PublicUser> {
  const user = await usersRepository.findById(userId);

  if (!user) {
    throw new UserNotFoundError(userId);
  }

  return toPublicUser(user);
}

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  const existingUser = await usersRepository.findByUsername(input.username);

  if (existingUser) {
    throw new UsernameAlreadyExistsError(input.username);
  }

  const now = new Date().toISOString();
  const user: NewUserRow = {
    username: input.username,
    passwordHash: await hashPassword(input.password),
    role: input.role ?? "player",
    createdAt: now,
    updatedAt: now,
  };

  const createdUser = await usersRepository.create(user);
  await ensureUserProgression(createdUser.id);

  if ((input.role ?? "player") === "player") {
    await addGoldToBank(createdUser.id, 10);
  }

  return toPublicUser(createdUser);
}

export async function updateUser(userId: number, input: UpdateUserInput): Promise<PublicUser> {
  const existingUser = await usersRepository.findById(userId);

  if (!existingUser) {
    throw new UserNotFoundError(userId);
  }

  if (input.username && input.username !== existingUser.username) {
    const userWithSameUsername = await usersRepository.findByUsername(input.username);

    if (userWithSameUsername) {
      throw new UsernameAlreadyExistsError(input.username);
    }
  }

  const updatedUser = await usersRepository.update(userId, {
    username: input.username,
    passwordHash: input.password ? await hashPassword(input.password) : undefined,
    role: input.role,
    updatedAt: new Date().toISOString(),
  });

  if (!updatedUser) {
    throw new UserNotFoundError(userId);
  }

  return toPublicUser(updatedUser);
}

export async function deleteUser(userId: number): Promise<void> {
  await getUser(userId);
  sqlite.exec(`
    DELETE FROM user_bank_items WHERE user_id = ${userId};
    DELETE FROM user_banks WHERE user_id = ${userId};
    DELETE FROM user_action_modifiers WHERE user_id = ${userId};
    DELETE FROM user_guild_memberships WHERE user_id = ${userId};
    DELETE FROM user_inventory_slot_bonuses WHERE user_id = ${userId};
    DELETE FROM user_inventory_items WHERE user_id = ${userId};
    DELETE FROM user_skills WHERE user_id = ${userId};
    DELETE FROM user_attribute_points WHERE user_id = ${userId};
    DELETE FROM user_attributes WHERE user_id = ${userId};
  `);
  await usersRepository.delete(userId);
}
