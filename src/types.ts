import type { FastifyRequest } from "fastify";

export type AuthContext = {
  user?: {
    id?: string;
  };
};

export type TeamRecord = {
  id: string;
  name: string;
  slug: string;
  inboxBase: string;
  storageLimitBytes?: bigint | number | null;
};

export type UserRecord = {
  id: string;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  username?: string | null;
  lastActiveTeamId?: string | null;
};

export type TeamMemberRecord = {
  teamId: string;
  userId: string;
  role: string;
  createdAt: Date;
  team?: TeamRecord;
  user?: UserRecord;
};

export type TeamRequest = FastifyRequest & {
  auth?: AuthContext;
  team?: TeamRecord;
  teamMember?: TeamMemberRecord;
  user?: UserRecord;
};
