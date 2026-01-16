export enum RoleNameType {
  Host = "host",
  Guest = "guest",
  Admin = "admin",
  Super_admin = "super_admin",
  Friend = "friend",
}

export type RoleReturned = {
  id: string;
  name: RoleNameType;
  description?: string;
  created_at: Date;
  updated_at: Date;
};
