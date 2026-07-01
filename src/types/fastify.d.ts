import type { AuthTokenPayload } from "../shared/auth/types";

declare module "fastify" {
  interface FastifyRequest {
    masterAuth?: AuthTokenPayload;
  }
}
