import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

type JwtHeader = {
  alg: "HS256";
  typ: "JWT";
};

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function encodeSegment(value: unknown): string {
  return base64UrlEncode(JSON.stringify(value));
}

function signMessage(message: string, secret: string): string {
  return createHmac("sha256", secret).update(message).digest("base64url");
}

export function signJwt<TPayload extends Record<string, unknown>>(
  payload: TPayload,
  secret: string,
): string {
  const header: JwtHeader = {
    alg: "HS256",
    typ: "JWT",
  };

  const body = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
  };

  const unsignedToken = `${encodeSegment(header)}.${encodeSegment(body)}`;
  const signature = signMessage(unsignedToken, secret);

  return `${unsignedToken}.${signature}`;
}

export function verifyJwt<TPayload extends Record<string, unknown>>(
  token: string,
  secret: string,
): TPayload {
  const [encodedHeader, encodedPayload, signature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !signature) {
    throw new Error("Invalid token format.");
  }

  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = signMessage(unsignedToken, secret);

  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    throw new Error("Invalid token signature.");
  }

  const header = JSON.parse(base64UrlDecode(encodedHeader)) as JwtHeader;
  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new Error("Unsupported token algorithm.");
  }

  return JSON.parse(base64UrlDecode(encodedPayload)) as TPayload;
}
