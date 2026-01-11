declare module "fastify" {
  interface FastifyRequest {
    auth?: { user?: { id?: string } };
    team?: unknown;
    teamMember?: { role?: string };
    user?: { id?: string };
  }
}
