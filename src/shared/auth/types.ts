export type AuthTokenRole = "master" | "player";

export type AuthTokenPayload = {
  sub: string;
  role: AuthTokenRole;
  username: string;
  iat: number;
};
