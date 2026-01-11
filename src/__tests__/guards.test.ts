import { describe, expect, it } from "vitest";
import { createTeamGuard } from "../guards/team-guard.js";

describe("team guard", () => {
  it("rejects without auth", async () => {
    const prisma = {
      user: { findUnique: async () => null },
      teamMember: { findUnique: async () => null },
    };
    const guard = createTeamGuard(prisma as never);
    const reply = {
      status: (code: number) => ({ send: (payload: unknown) => ({ code, payload }) }),
    } as never;
    const response = await guard({ headers: {}, auth: {} } as never, reply);
    expect(response).toEqual({ code: 401, payload: { error: "missing_auth" } });
  });

  it("rejects missing team", async () => {
    const prisma = {
      user: { findUnique: async () => ({ id: "user-1", lastActiveTeamId: null }) },
      teamMember: { findUnique: async () => null },
    };
    const guard = createTeamGuard(prisma as never);
    const reply = {
      status: (code: number) => ({ send: (payload: unknown) => ({ code, payload }) }),
    } as never;
    const request = { headers: {}, auth: { user: { id: "user-1" } } } as never;
    const response = await guard(request, reply);
    expect(response).toEqual({ code: 400, payload: { error: "missing_team" } });
  });
});
