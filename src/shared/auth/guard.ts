import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env";
import { verifyJwt } from "./jwt";
import { MASTER_USERNAME } from "../../modules/auth/auth.constants";
import type { AuthTokenPayload } from "./types";

function readBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export async function requireMasterAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void | FastifyReply> {
  const token = readBearerToken(request.headers.authorization);

  if (!token) {
    return reply.status(401).send({
      message: "Missing bearer token.",
    });
  }

  try {
    const payload = verifyJwt<AuthTokenPayload>(token, env.JWT_SECRET);

    if (payload.role !== "master" || payload.username !== MASTER_USERNAME) {
      return reply.status(401).send({
        message: "Master token required.",
      });
    }

    request.masterAuth = payload;
  } catch {
    return reply.status(401).send({
      message: "Invalid or expired token.",
    });
  }
}
