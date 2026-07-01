import { buildApp } from "./server/app";

const { app, config } = await buildApp();

await app.listen({
  host: "0.0.0.0",
  port: config.PORT,
});
