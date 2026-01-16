import { RoleNameType } from "./roles.type";

export type JwtPayload = {
  sub: string;
  email: string;
  role: {
    name: RoleNameType;
    id: number;
  };
};
