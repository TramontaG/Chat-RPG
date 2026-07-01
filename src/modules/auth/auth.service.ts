import { env } from "../../config/env";
import { db } from "../../database/client";
import { users } from "../../database/schema";
import { signJwt } from "../../shared/auth/jwt";
import type { AuthTokenPayload } from "../../shared/auth/types";
import { hashPassword, verifyPassword } from "../../shared/security/password";
import { MASTER_USERNAME } from "./auth.constants";
import { InvalidCredentialsError } from "./auth.errors";
import { UsersRepository } from "../../database/repositories/users.repository";

const usersRepository = new UsersRepository(db);

export async function ensureMasterUser(): Promise<void> {
  const existingUser = await usersRepository.findByUsername(MASTER_USERNAME);

  if (existingUser && existingUser.role !== "master") {
    throw new Error(`Existing user "${MASTER_USERNAME}" must have role "master".`);
  }

  if (existingUser) {
    return;
  }

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(env.MASTER_PASSWORD);

  db.insert(users).values({
    username: MASTER_USERNAME,
    passwordHash,
    role: "master",
    createdAt: now,
    updatedAt: now,
  }).run();
}

export async function loginUser(username: string, password: string): Promise<{
  token: string;
  tokenType: "Bearer";
  expiresAt: null;
  user: {
    id: number;
    username: string;
    role: "master" | "player";
  };
}> {
  const user = await usersRepository.findByUsername(username);

  if (!user) {
    throw new InvalidCredentialsError();
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new InvalidCredentialsError();
  }

  const tokenPayload: Omit<AuthTokenPayload, "iat"> = {
    sub: String(user.id),
    role: user.role,
    username: user.username,
  };

  return {
    token: signJwt(tokenPayload, env.JWT_SECRET),
    tokenType: "Bearer",
    expiresAt: null,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  };
}
