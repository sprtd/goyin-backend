import { RoleNameType } from './roles.type';

export type IUser = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  is_verified: boolean;
  role: number;
  role_name: RoleNameType;
  role_id: number;
  user_profile: number;
  created_at: Date;
  updated_at: Date;
  password: string;
};
