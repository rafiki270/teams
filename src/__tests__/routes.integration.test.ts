import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerTeamRoutes, registerUserTeamSettingsRoutes } from "../index.js";

type User = {
  id: string;
  email: string | null;
  fullName: string | null;
  username: string;
  lastActiveTeamId: string | null;
};

type Team = {
  id: string;
  name: string;
  slug: string;
  inboxBase: string;
  storageLimitBytes: bigint;
};

type TeamMember = {
  teamId: string;
  userId: string;
  role: string;
  createdAt: Date;
};

describe("team routes integration", () => {
  it("creates and lists teams", async () => {
    const state = {
      users: new Map<string, User>(),
      teams: new Map<string, Team>(),
      members: [] as TeamMember[],
      settings: new Map<string, unknown>(),
    };

    const user: User = {
      id: "user-1",
      email: "user@example.com",
      fullName: "Test User",
      username: "tester",
      lastActiveTeamId: null,
    };
    state.users.set(user.id, user);

    const prisma = {
      user: {
        findUnique: async ({ where }: { where: { id: string } }) => state.users.get(where.id) ?? null,
        update: async ({ where, data }: { where: { id: string }; data: { lastActiveTeamId?: string } }) => {
          const entry = state.users.get(where.id);
          if (!entry) return null;
          if (data.lastActiveTeamId !== undefined) {
            entry.lastActiveTeamId = data.lastActiveTeamId;
          }
          return entry;
        },
      },
      team: {
        findUnique: async ({ where }: { where: { slug?: string; id?: string } }) => {
          if (where.slug) {
            return Array.from(state.teams.values()).find((team) => team.slug === where.slug) ?? null;
          }
          if (where.id) {
            return state.teams.get(where.id) ?? null;
          }
          return null;
        },
        create: async ({ data }: { data: Partial<Team> }) => {
          const id = data.id || `team-${state.teams.size + 1}`;
          const team: Team = {
            id,
            name: data.name || "Team",
            slug: data.slug || `team-${state.teams.size + 1}`,
            inboxBase: data.inboxBase || "team",
            storageLimitBytes: data.storageLimitBytes ?? BigInt(1073741824),
          };
          state.teams.set(team.id, team);
          return team;
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<Team> }) => {
          const team = state.teams.get(where.id);
          if (!team) return null;
          Object.assign(team, data);
          return team;
        },
      },
      teamMember: {
        findMany: async ({ where }: { where: { userId: string } }) =>
          state.members
            .filter((member) => member.userId === where.userId)
            .map((member) => ({ ...member, team: state.teams.get(member.teamId) })),
        findFirst: async ({ where }: { where: { userId: string } }) => {
          const member = state.members.find((entry) => entry.userId === where.userId);
          if (!member) return null;
          return { ...member, team: state.teams.get(member.teamId) };
        },
        findUnique: async ({ where }: { where: { teamId_userId: { teamId: string; userId: string } } }) => {
          const member = state.members.find(
            (entry) => entry.teamId === where.teamId_userId.teamId && entry.userId === where.teamId_userId.userId,
          );
          if (!member) return null;
          return { ...member, team: state.teams.get(member.teamId), user: user };
        },
        create: async ({ data }: { data: TeamMember }) => {
          state.members.push(data);
          return data;
        },
        count: async () => 1,
        delete: async () => ({ id: "deleted" }),
        update: async () => ({ id: "updated" }),
      },
      userTeamSetting: {
        findUnique: async ({ where }: { where: { userId_teamId_key: { userId: string; teamId: string; key: string } } }) => {
          const key = `${where.userId_teamId_key.userId}:${where.userId_teamId_key.teamId}:${where.userId_teamId_key.key}`;
          if (!state.settings.has(key)) return null;
          return { value: state.settings.get(key) };
        },
        upsert: async ({ where, create, update }: { where: { userId_teamId_key: { userId: string; teamId: string; key: string } }; create: { value: unknown }; update: { value: unknown } }) => {
          const key = `${where.userId_teamId_key.userId}:${where.userId_teamId_key.teamId}:${where.userId_teamId_key.key}`;
          const value = create.value ?? update.value;
          state.settings.set(key, value);
          return { value };
        },
      },
      $transaction: async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    } as never;

    const app = Fastify({ logger: false });
    const requireAuth = async (request: { auth?: { user?: { id: string } } }) => {
      request.auth = { user: { id: user.id } };
    };

    await registerTeamRoutes(app, {
      prisma,
      inboundEmailDomain: "local.example",
      requireAuth,
    });

    await registerUserTeamSettingsRoutes(app, { prisma, requireAuth });

    const create = await app.inject({ method: "POST", url: "/teams", payload: { name: "Core" } });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({ method: "GET", url: "/teams" });
    expect(list.statusCode).toBe(200);

    const teamId = (create.json() as { team: { id: string } }).team.id;

    const inbox = await app.inject({ method: "GET", url: `/teams/${teamId}/inbox` });
    expect(inbox.statusCode).toBe(200);

    const settings = await app.inject({
      method: "PUT",
      url: "/user-team-settings/theme",
      payload: { value: "dark" },
      headers: { "x-team-id": teamId },
    });
    expect(settings.statusCode).toBe(200);
  });
});
