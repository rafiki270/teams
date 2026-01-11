import type { FastifyRequest } from "fastify";

export type AuthContext = {
  user?: {
    id?: string;
  };
};

export type TeamRequest = FastifyRequest & {
  auth?: AuthContext;
  team?: unknown;
  teamMember?: { role?: string };
  user?: { id?: string };
};
