import crypto from "crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { createTeamGuard } from "../guards/team-guard.js";
import { createTeamRoleGuard } from "../guards/team-role.js";
import type { TeamRequest } from "../types.js";

export type TeamInviteRoutesOptions = {
  prisma: PrismaClient;
  requireAuth: (request: TeamRequest, reply: FastifyReply) => Promise<unknown> | unknown;
};

const normalizeDomain = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const domainPattern = /^(?!-)[a-z0-9.-]+\.[a-z]{2,}$/i;
  if (!domainPattern.test(trimmed)) return "invalid";
  return trimmed;
};

const getRemainingUses = (maxUses: number, usedCount: number) => {
  if (!maxUses) return null;
  return Math.max(maxUses - usedCount, 0);
};

const buildAcceptPath = (token: string) => `/accept-invite?token=${encodeURIComponent(token)}`;

const parseToken = (input: string) => {
  try {
    const url = new URL(input);
    const fromQuery = url.searchParams.get("token");
    if (fromQuery) {
      return fromQuery.trim();
    }
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) {
      return last.trim();
    }
  } catch {
    return input.trim();
  }
  return input.trim();
};

export async function registerTeamInviteRoutes(app: FastifyInstance, options: TeamInviteRoutesOptions) {
  const { prisma, requireAuth } = options;
  const requireTeam = createTeamGuard(prisma);
  const requireTeamRole = createTeamRoleGuard;

  app.post(
    "/teams/:teamId/invites",
    { preHandler: [requireAuth, requireTeam, requireTeamRole(["owner", "admin"])] },
    async (request: TeamRequest, reply) => {
      const paramsTeamId = String((request.params as { teamId?: string })?.teamId || "").trim();
      const team = request.team;
      if (!team) {
        return reply.status(400).send({ error: "team_required" });
      }
      if (paramsTeamId && team.id !== paramsTeamId) {
        return reply.status(403).send({ error: "forbidden" });
      }
      const body = request.body as { maxUses?: unknown; allowedDomain?: unknown };
      const maxUses =
        typeof body?.maxUses === "number" && Number.isFinite(body.maxUses) && body.maxUses >= 0
          ? Math.min(Math.floor(body.maxUses), 10_000)
          : 0;
      const normalizedDomain = normalizeDomain(body?.allowedDomain);
      if (normalizedDomain === "invalid") {
        return reply.status(400).send({ error: "invalid_domain" });
      }
      const token = crypto.randomBytes(24).toString("base64url");
      const created = await prisma.teamInvite.create({
        data: {
          teamId: team.id,
          token,
          maxUses,
          allowedDomain: normalizedDomain || null,
          createdByUserId: request.auth?.user?.id ?? request.user?.id ?? "",
        },
      });
      const remainingUses = getRemainingUses(created.maxUses, created.usedCount);
      return reply.status(201).send({
        invite: {
          token: created.token,
          teamId: created.teamId,
          allowedDomain: created.allowedDomain,
          maxUses: created.maxUses,
          remainingUses,
          path: buildAcceptPath(created.token),
        },
      });
    },
  );

  app.get("/invites/:token", async (request: TeamRequest, reply) => {
    const rawToken = String((request.params as { token?: string })?.token || "").trim();
    const token = parseToken(rawToken);
    if (!token) {
      return reply.status(400).send({ error: "missing_token" });
    }
    const invite = await prisma.teamInvite.findUnique({
      where: { token },
      include: { team: true },
    });
    if (!invite) {
      return reply.status(404).send({ error: "invite_not_found" });
    }
    const remainingUses = getRemainingUses(invite.maxUses, invite.usedCount);
    if (remainingUses !== null && remainingUses <= 0) {
      return reply.status(410).send({ error: "invite_exhausted" });
    }
    return reply.send({
      invite: {
        token: invite.token,
        teamId: invite.teamId,
        teamName: invite.team?.name ?? "Team",
        teamSlug: invite.team?.slug ?? "",
        allowedDomain: invite.allowedDomain,
        maxUses: invite.maxUses,
        remainingUses,
      },
    });
  });

  app.post("/invites/:token/accept", { preHandler: requireAuth }, async (request: TeamRequest, reply) => {
    const rawToken = String((request.params as { token?: string })?.token || "").trim();
    const token = parseToken(rawToken);
    if (!token) {
      return reply.status(400).send({ error: "missing_token" });
    }
    const authUserId = request.auth?.user?.id;
    if (!authUserId) {
      return reply.status(401).send({ error: "missing_auth" });
    }
    const invite = await prisma.teamInvite.findUnique({
      where: { token },
      include: { team: true },
    });
    if (!invite) {
      return reply.status(404).send({ error: "invite_not_found" });
    }
    const remainingUses = getRemainingUses(invite.maxUses, invite.usedCount);
    if (remainingUses !== null && remainingUses <= 0) {
      return reply.status(410).send({ error: "invite_exhausted" });
    }
    const user = await prisma.user.findUnique({
      where: { id: authUserId },
      select: { id: true, email: true },
    });
    if (!user) {
      return reply.status(401).send({ error: "user_not_found" });
    }
    if (invite.allowedDomain) {
      const emailDomain = (user.email || "").split("@")[1]?.toLowerCase();
      if (!emailDomain || emailDomain !== invite.allowedDomain.toLowerCase()) {
        return reply.status(403).send({ error: "domain_restricted" });
      }
    }
    const existingMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: invite.teamId, userId: user.id } },
    });

    const joined = await prisma.$transaction(async (tx: PrismaClient) => {
      if (!existingMember) {
        await tx.teamMember.create({
          data: { teamId: invite.teamId, userId: user.id, role: "member", createdAt: new Date() },
        });
        if (invite.maxUses > 0) {
          await tx.teamInvite.update({
            where: { id: invite.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }
      await tx.user.update({
        where: { id: user.id },
        data: { lastActiveTeamId: invite.teamId },
      });
      return !existingMember;
    });

    const nextRemaining = getRemainingUses(
      invite.maxUses,
      invite.usedCount + (invite.maxUses > 0 && !existingMember ? 1 : 0),
    );

    return reply.send({
      teamId: invite.teamId,
      teamName: invite.team?.name ?? "Team",
      joined,
      alreadyMember: Boolean(existingMember),
      remainingUses: nextRemaining,
    });
  });
}
