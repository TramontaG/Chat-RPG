import { and, eq } from "drizzle-orm";
import type { db as dbClient } from "../../database/client";
import {
  guilds,
  userGuildMemberships,
  type GuildRow,
  type NewGuildRow,
  type NewUserGuildMembershipRow,
  type UserGuildMembershipRow,
} from "../../database/schema";

type Database = typeof dbClient;

export class GuildsRepository {
  constructor(private readonly database: Database) {}

  async findAll(): Promise<GuildRow[]> {
    return this.database.select().from(guilds).all();
  }

  async findById(id: number): Promise<GuildRow | undefined> {
    const rows = this.database.select().from(guilds).where(eq(guilds.id, id)).limit(1).all();

    return rows[0];
  }

  async findByName(name: string): Promise<GuildRow | undefined> {
    const rows = this.database.select().from(guilds).where(eq(guilds.name, name)).limit(1).all();

    return rows[0];
  }

  async create(guild: NewGuildRow): Promise<GuildRow> {
    const rows = this.database.insert(guilds).values(guild).returning().all();
    const createdGuild = rows[0];

    if (!createdGuild) {
      throw new Error("Failed to create guild.");
    }

    return createdGuild;
  }

  async listMembershipsByUserId(userId: number): Promise<UserGuildMembershipRow[]> {
    return this.database
      .select()
      .from(userGuildMemberships)
      .where(eq(userGuildMemberships.userId, userId))
      .all();
  }

  async listMembershipsByGuildId(guildId: number): Promise<UserGuildMembershipRow[]> {
    return this.database
      .select()
      .from(userGuildMemberships)
      .where(eq(userGuildMemberships.guildId, guildId))
      .all();
  }

  async findMembership(
    userId: number,
    guildId: number,
  ): Promise<UserGuildMembershipRow | undefined> {
    const rows = this.database
      .select()
      .from(userGuildMemberships)
      .where(and(eq(userGuildMemberships.userId, userId), eq(userGuildMemberships.guildId, guildId)))
      .limit(1)
      .all();

    return rows[0];
  }

  async createMembership(membership: NewUserGuildMembershipRow): Promise<UserGuildMembershipRow> {
    const rows = this.database.insert(userGuildMemberships).values(membership).returning().all();
    const createdMembership = rows[0];

    if (!createdMembership) {
      throw new Error("Failed to create guild membership.");
    }

    return createdMembership;
  }

  async deleteMembership(userId: number, guildId: number): Promise<void> {
    this.database
      .delete(userGuildMemberships)
      .where(and(eq(userGuildMemberships.userId, userId), eq(userGuildMemberships.guildId, guildId)))
      .run();
  }
}
