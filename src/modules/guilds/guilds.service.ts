import { db } from "../../database/client";
import type { GuildRow, UserGuildMembershipRow } from "../../database/schema";
import { GuildsRepository } from "./guilds.repository";

const guildsRepository = new GuildsRepository(db);

export class GuildNotFoundError extends Error {
  constructor(guildId: number) {
    super(`Guild not found: ${guildId}`);
    this.name = "GuildNotFoundError";
  }
}

export class GuildAlreadyExistsError extends Error {
  constructor(name: string) {
    super(`Guild already exists: ${name}`);
    this.name = "GuildAlreadyExistsError";
  }
}

export type CreateGuildInput = {
  name: string;
  description?: string;
};

export async function listGuilds(): Promise<GuildRow[]> {
  return guildsRepository.findAll();
}

export async function getGuildOrThrow(guildId: number): Promise<GuildRow> {
  const guild = await guildsRepository.findById(guildId);

  if (!guild) {
    throw new GuildNotFoundError(guildId);
  }

  return guild;
}

export async function createGuild(input: CreateGuildInput): Promise<GuildRow> {
  const existingGuild = await guildsRepository.findByName(input.name);

  if (existingGuild) {
    throw new GuildAlreadyExistsError(input.name);
  }

  const now = new Date().toISOString();

  return guildsRepository.create({
    name: input.name,
    description: input.description ?? "",
    createdAt: now,
    updatedAt: now,
  });
}

export async function listUserGuildMemberships(
  userId: number,
): Promise<UserGuildMembershipRow[]> {
  return guildsRepository.listMembershipsByUserId(userId);
}

export async function listGuildMemberships(
  guildId: number,
): Promise<UserGuildMembershipRow[]> {
  await getGuildOrThrow(guildId);

  return guildsRepository.listMembershipsByGuildId(guildId);
}

export async function joinGuild(
  userId: number,
  guildId: number,
  role = "member",
): Promise<UserGuildMembershipRow> {
  await getGuildOrThrow(guildId);
  const existingMembership = await guildsRepository.findMembership(userId, guildId);

  if (existingMembership) {
    return existingMembership;
  }

  const now = new Date().toISOString();

  return guildsRepository.createMembership({
    userId,
    guildId,
    role,
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

export async function leaveGuild(userId: number, guildId: number): Promise<boolean> {
  await getGuildOrThrow(guildId);
  const existingMembership = await guildsRepository.findMembership(userId, guildId);

  if (!existingMembership) {
    return false;
  }

  await guildsRepository.deleteMembership(userId, guildId);
  return true;
}
