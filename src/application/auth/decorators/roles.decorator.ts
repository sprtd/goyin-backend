import { SetMetadata } from "@nestjs/common";
import { RoleNameType } from "@/interfaces/types/users/roles.type";

export const ROLES_KEY = "roles";
export const Roles = (...roles: RoleNameType[]) => SetMetadata(ROLES_KEY, roles);
