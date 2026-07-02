import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { InvalidCredentialsError } from "./auth.errors";
import { loginUser, signupUser } from "./auth.service";
import { UsernameAlreadyExistsError } from "../users/users.service";

const loginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const signupBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/signup", async (request, reply) => {
    const body = signupBodySchema.parse(request.body);

    try {
      return reply.status(201).send(await signupUser(body.username, body.password));
    } catch (error) {
      if (error instanceof UsernameAlreadyExistsError) {
        return reply.status(409).send({
          message: "Username already exists.",
        });
      }

      throw error;
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginBodySchema.parse(request.body);

    try {
      return await loginUser(body.username, body.password);
    } catch (error) {
      if (!(error instanceof InvalidCredentialsError)) {
        throw error;
      }

      return reply.status(401).send({
        message: "Invalid credentials.",
      });
    }
  });
}
