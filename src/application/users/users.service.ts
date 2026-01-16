import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { CreateUserType } from "./dto/create-user.dto";
import { DATABASE_CONNECTION } from "@/infrastructure/database/database.provider";
import type { Drizzle } from "@/interfaces/types/drizzle";
import { paginationTypes } from "@/interfaces/types/constant-types";
import { ValidateUserType } from "./dto/find-all-user.dto";
import * as schema from "@/infrastructure/persistence/index";
import { and, asc, desc, eq, lt } from "drizzle-orm";
import * as bcrypt from "bcryptjs";
import { generateSixDigitToken } from "@/helpers/generate-token";
import { FilesService } from "../files/files.service";
import { addMinutes, isAfter } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { AllowedRoles } from "../auth/dto/sign-up.dto";
import { RoleNameType } from "@/interfaces/types/users";

const saltOrRounds = parseInt(process.env.SALT_ROUNDS || "10", 10);

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Drizzle,
    private fileService: FilesService
  ) {}

  async create(createUserDto: CreateUserType & { role?: string; password?: string }): Promise<any> {
    // console.log("🚀 ~ UsersService ~ createUserDto:", createUserDto)
    // First, get the role_id based on the role name
    const roleId = await this.getRoleIdByName(createUserDto.role);
    if (!roleId) {
      throw new BadRequestException(`Invalid role: ${createUserDto.role}`);
    }

    const userExists = await this.findByEmail(createUserDto.email);

    // console.log('🚀 ~ UsersService ~ userExists:', userExists);

    if (userExists && userExists.id) {
      // Existing user logic
      return this.handleExistingUser(userExists, {
        ...createUserDto,
        role: roleId,
      });
    } else {
      // New user logic
      return this.createNewUser({ ...createUserDto, role: roleId });
    }
  }

  private async handleExistingUser(
    userExists: any,
    createUserDto: CreateUserType & { role?: number; password?: string }
  ) {
    const findRolesViaId = await this.db
      .select()
      .from(schema.user_roles)
      .where(eq(schema.user_roles.user_id, userExists.id));

    if (findRolesViaId && findRolesViaId.length) {
      const userFind = findRolesViaId.find(
        (user) => user.role_id === (createUserDto.role as unknown as number)
      );

      if (userFind) {
        throw new ConflictException({
          message: `User with email ${createUserDto.email} already exists, try signing in instead.`,
          code: "409",
          action: "sign-in-new-role-existing-user",
        });
      }

      throw new ConflictException({
        message: `User with email ${createUserDto.email} already exists and has different role, try signing in instead.`,
        code: "409",
        action: "sign-in-new-role-different-existing-user",
      });
    }

    if (!userExists.is_verified) {
      return this.handleUnverifiedUser(userExists);
    }

    throw new ConflictException({
      message: `User with email ${createUserDto.email} already exists. New roles cannot be added during signup.`,
      code: "409",
      action: "existing-user-new-role-not-allowed",
    });
  }

  private async handleUnverifiedUser(userExists: any) {
    const checkRetryCount = await this.checkEmailRetrys(userExists.id);

    if (!checkRetryCount) {
      return {
        message: "Too many retries, please try again in 1hr or contact support for assistance",
        code: "429",
      };
    }

    const savedToken = await this.saveVerificationToken(userExists.id);

    if (!savedToken) {
      throw new InternalServerErrorException("unknown error");
    }

    return { user: [userExists], savedToken: [{ token: savedToken }] };
  }

  private async createNewUser(
    createUserDto: CreateUserType & { role?: number; password?: string }
  ) {
    const hashedPassword = await bcrypt.hash(createUserDto.password || "", saltOrRounds);

    const result = await this.db.transaction(async (trx) => {
      const user = await trx
        .insert(schema.users)
        .values({
          ...createUserDto,
          password: createUserDto?.password ? hashedPassword : null,
          is_verified: false,
        })
        .returning();

      const role = await trx
        .insert(schema.user_roles)
        .values({
          user_id: String(user[0].id),
          role_id: createUserDto.role,
        } as any)
        .returning();

      const savedToken = await trx
        .insert(schema.user_verification as any)
        .values({
          user_id: user[0].id,
          token: generateSixDigitToken(),
          expires_at: addMinutes(new Date(), 15),
        })
        .returning({ token: schema.user_verification.token });

      return { user, role, savedToken };
    });

    return result;
  }

  async addNewRoleToUser(
    userExists: {
      id: number;
      email: string;
      first_name: string;
      last_name: string;
    },
    role: AllowedRoles
  ) {
    // ensure the role passed are the only valid roles of AllowedRoles
    if (!Object.values(AllowedRoles).includes(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    const roleId = await this.getRoleIdByName(role);
    if (!roleId) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    const result = await this.db.transaction(async (trx) => {
      const role = await trx
        .insert(schema.user_roles)
        .values({
          user_id: +userExists.id,
          role_id: roleId,
        })
        .returning();

      return { user: [userExists], role };
    });

    return result;
  }

  async getUserRolesViaEmail(email: string) {
    const userRoles = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        role_name: schema.roles.name,
        role_id: schema.roles.id,
      })
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .innerJoin(schema.user_roles, eq(schema.users.id, schema.user_roles.user_id))
      .innerJoin(schema.roles, eq(schema.user_roles.role_id, schema.roles.id));

    // console.log(
    //   '🚀 ~ UsersService ~ getUserRolesViaEmail ~ userRoles:',
    //   userRoles,
    // );
    return userRoles;
  }

  async findByEmail(email: string) {
    const user = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.lower(schema.users.email), email.toLowerCase()));

    // console.log('🚀 ~ UsersService ~ findByEmail ~ user:', user);
    return user[0];
  }

  async findByPhone(phone: string) {
    const user = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.lower(schema.users.phone), phone.toLowerCase()))
      .limit(1);

    return user[0];
  }

  hasCountryCode(phone: string): boolean {
    if (phone.startsWith("+3333")) {
      return false;
    }
    // This regex checks for a '+' followed by 1-3 digits at the start of the string
    return /^\+\d{1,3}/.test(phone);
  }

  // Helper methods for validation
  isValidEmail(email: string): boolean {
    // Simple email regex, you might want to use a more comprehensive one
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  isValidPhone(phone: string): boolean {
    // Check if phone number is valid (including country code)
    const phoneRegex = /^\+\d{1,4}\s\d{4,14}$/;
    return phoneRegex.test(phone) && phone.length <= 19;
  }
  async comparePassword(password: string, hashedPassword: string) {
    return await bcrypt.compare(password, hashedPassword);
  }

  async upsertRefreshToken(id: number | string, payload: string) {
    // First, get the current user's refresh tokens
    const currentUser = await this.db
      .select({ refresh_token: schema.users.refresh_token })
      .from(schema.users)
      .where(eq(schema.users.id, +id))
      .limit(1);

    if (!currentUser || !currentUser[0]) {
      throw new BadRequestException("User not found");
    }

    let refreshTokens: string[] = [];

    // Parse existing refresh tokens (handle null/undefined cases)
    if (currentUser[0].refresh_token) {
      if (Array.isArray(currentUser[0].refresh_token)) {
        refreshTokens = currentUser[0].refresh_token;
      } else if (typeof currentUser[0].refresh_token === "string") {
        // Handle case where it might be stored as a single string
        refreshTokens = [currentUser[0].refresh_token];
      }
    }

    // Add the new token to the beginning of the array
    refreshTokens.unshift(payload);

    // Keep only the 2 most recent tokens (remove oldest if more than 2)
    if (refreshTokens.length > 2) {
      refreshTokens = refreshTokens.slice(0, 2);
    }

    // Update the user with the new refresh tokens array
    const updatedUser = await this.db
      .update(schema.users)
      .set({ refresh_token: refreshTokens })
      .where(eq(schema.users.id, +id))
      .returning({
        updatedId: schema.users.id,
        refresh_token: schema.users.refresh_token,
      });

    return updatedUser;
  }

  async validateRefreshToken(id: number, token: string): Promise<boolean> {
    const user = await this.db
      .select({ refresh_token: schema.users.refresh_token })
      .from(schema.users)
      .where(eq(schema.users.id, +id))
      .limit(1);

    if (!user || !user[0] || !user[0].refresh_token) {
      return false;
    }

    let refreshTokens: string[] = [];

    if (Array.isArray(user[0].refresh_token)) {
      refreshTokens = user[0].refresh_token;
    } else if (typeof user[0].refresh_token === "string") {
      refreshTokens = [user[0].refresh_token];
    }

    return refreshTokens.includes(token);
  }

  async removeRefreshToken(id: number, tokenToRemove: string) {
    const currentUser = await this.db
      .select({ refresh_token: schema.users.refresh_token })
      .from(schema.users)
      .where(eq(schema.users.id, +id))
      .limit(1);

    if (!currentUser || !currentUser[0] || !currentUser[0].refresh_token) {
      return null;
    }

    let refreshTokens: string[] = [];

    if (Array.isArray(currentUser[0].refresh_token)) {
      refreshTokens = currentUser[0].refresh_token;
    } else if (typeof currentUser[0].refresh_token === "string") {
      refreshTokens = [currentUser[0].refresh_token];
    }

    // Remove the specific token
    refreshTokens = refreshTokens.filter((token) => token !== tokenToRemove);

    const updatedUser = await this.db
      .update(schema.users)
      .set({ refresh_token: refreshTokens.length > 0 ? refreshTokens : null })
      .where(eq(schema.users.id, +id))
      .returning({
        updatedId: schema.users.id,
        refresh_token: schema.users.refresh_token,
      });

    return updatedUser;
  }
  async saveVerificationToken(id) {
    const savedToken = await this.db
      .insert(schema.user_verification as any)
      .values({
        user_id: id,
        token: generateSixDigitToken(),
        expires_at: addMinutes(new Date(), 5),
      })
      .returning({ token: schema.user_verification.token });
    return savedToken[0].token;
  }

  async checkEmailRetrys(id) {
    const emailRetrysCount = await this.db.$count(
      schema.user_verification,
      eq(schema.user_verification.user_id, id)
    );

    if (emailRetrysCount >= 3) {
      return false;
    }
    return true;
  }

  async verifyToken(payload) {
    const userExists = await this.findByEmail(payload.email);
    if (!userExists || !userExists.id) {
      throw new UnauthorizedException("Invalid or expired token");
    }
    // check if user has been verified already
    if (userExists.is_verified) {
      throw new BadRequestException("User already verified");
    }

    const userVerification = await this.db
      .select()
      .from(schema.user_verification)
      .where(eq(schema.user_verification.user_id, +userExists.id))
      .orderBy(desc(schema.user_verification.created_at));

    if (!userVerification || !userVerification.length) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    if (payload.token !== userVerification[0].token) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const dbTime = userVerification[0].expires_at;
    const serverTime = new Date();

    // Convert both times to the same time zone (UTC)
    const dbTimeUtc = formatInTimeZone(dbTime, "UTC", "yyyy-MM-dd HH:mm:ss zzz");
    const serverTimeUtc = formatInTimeZone(serverTime, "UTC", "yyyy-MM-dd HH:mm:ss zzz");

    // Add a 1-minute buffer to the expiration time
    const adjustedExpiration = addMinutes(dbTimeUtc, 1);

    console.log("here", serverTimeUtc, adjustedExpiration);
    // Compare the dates
    if (isAfter(serverTimeUtc, adjustedExpiration)) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const updatedUser = await this.db
      .update(schema.users)
      .set({ is_verified: true })
      .where(eq(schema.users.id, userExists.id))
      .returning();

    if (!updatedUser) {
      throw new InternalServerErrorException("unknown error");
    }

    return updatedUser;
  }

  async verifyGuestUserToken(payload) {
    let userExists;

    if (payload.email) {
      userExists = await this.findByEmail(payload.email);
    }
    if (payload.phone) {
      userExists = await this.findByPhone(payload.phone);
    }
    if (!userExists || !userExists.id) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const userVerification = await this.db
      .select()
      .from(schema.user_verification)
      .where(eq(schema.user_verification.user_id, userExists.id))
      .orderBy(desc(schema.user_verification.created_at));

    if (!userVerification || !userVerification.length) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    if (payload.token !== userVerification[0].token) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const dbTime = userVerification[0].expires_at;
    const serverTime = new Date();

    // Convert both times to the same time zone (UTC)
    const dbTimeUtc = formatInTimeZone(dbTime, "UTC", "yyyy-MM-dd HH:mm:ss zzz");
    const serverTimeUtc = formatInTimeZone(serverTime, "UTC", "yyyy-MM-dd HH:mm:ss zzz");

    // Add a 1-minute buffer to the expiration time
    const adjustedExpiration = addMinutes(dbTimeUtc, 1);

    console.log("here", serverTimeUtc, adjustedExpiration);
    // Compare the dates
    if (isAfter(serverTimeUtc, adjustedExpiration)) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const updatedUser = await this.db
      .update(schema.users)
      .set({ is_verified: true })
      .where(eq(schema.users.id, userExists.id))
      .returning();

    if (!updatedUser) {
      throw new InternalServerErrorException("unknown error");
    }

    return updatedUser;
  }

  async resendToken(payload) {
    const userExists = await this.findByEmail(payload.email);

    if (!userExists) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const checkRetryCount = await this.checkEmailRetrys(userExists.id);

    if (!checkRetryCount) {
      return {
        message: "Too many retries, please try again in 1hr or contact support for assistance",
        code: "429",
      };
    }

    const savedToken = await this.saveVerificationToken(userExists.id);

    if (!savedToken) {
      throw new InternalServerErrorException("unknown error");
    }

    return { ...userExists, token: savedToken };
  }

  async forgotPasswordEmailVerification(payload) {
    const result = await this.resendToken(payload);
    return result;
  }

  async confirmForgotPasswordToken(payload) {
    const userExists = await this.findByEmail(payload.email);
    if (!userExists || !userExists.id) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const userVerification = await this.db
      .select()
      .from(schema.user_verification)
      .where(eq(schema.user_verification.user_id, userExists.id))
      .orderBy(desc(schema.user_verification.created_at));

    if (!userVerification || !userVerification.length) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    if (payload.token !== userVerification[0].token) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const dbTime = userVerification[0].expires_at;
    const serverTime = new Date();

    // Convert both times to the same time zone (UTC)
    const dbTimeUtc = formatInTimeZone(dbTime, "UTC", "yyyy-MM-dd HH:mm:ss zzz");
    const serverTimeUtc = formatInTimeZone(serverTime, "UTC", "yyyy-MM-dd HH:mm:ss zzz");

    // Add a 1-minute buffer to the expiration time
    const adjustedExpiration = addMinutes(dbTimeUtc, 1);

    console.log("here", serverTimeUtc, adjustedExpiration);
    // Compare the dates
    if (isAfter(serverTimeUtc, adjustedExpiration)) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    // change the password
    const hashedPassword = await bcrypt.hash(payload.password, saltOrRounds);

    const updatedUser = await this.db
      .update(schema.users)
      .set({ password: hashedPassword })
      .where(eq(schema.users.id, userExists.id))
      .returning();

    return updatedUser;
  }

  async changePassword(user, payload) {
    const userExists = await this.findByEmail(user.email);
    if (!userExists || !userExists.id) {
      throw new UnauthorizedException("Unauthorized");
    }

    if (userExists.password === null) {
      throw new BadRequestException("Password change not allowed for social login users");
    }

    const unHashedPassword = await this.comparePassword(payload.old_password, userExists.password);

    if (!unHashedPassword) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const hashedPassword = await bcrypt.hash(payload.new_password, saltOrRounds);

    const updatedUser = await this.db
      .update(schema.users)
      .set({ password: hashedPassword, refresh_token: user.refresh_token })
      .where(eq(schema.users.id, userExists.id))
      .returning();

    return updatedUser;
  }

  async deleteExpiredTokens() {
    const expiredTokens = await this.db
      .delete(schema.user_verification)
      .where(lt(schema.user_verification.expires_at, new Date()));

    return expiredTokens;
  }

  async listAllRoles() {
    const roles = await this.db.select().from(schema.roles).orderBy(asc(schema.roles.id));

    return roles;
  }

  normalizePhoneNumber(phone: string): string {
    // Remove all whitespace first
    let normalized = phone.replace(/\s/g, "");

    // Check if it starts with a '+' and has at least 5 digits
    if (normalized.startsWith("+") && normalized.length >= 5) {
      // Insert a space after the country code (assuming 1-4 digits for country code)
      const countryCodeEnd = Math.min(normalized.indexOf("+") + 5, normalized.length);
      normalized = normalized.slice(0, countryCodeEnd) + " " + normalized.slice(countryCodeEnd);
    }

    // Return the normalized version, which will have a space if it was valid
    return normalized;
  }

  async getRoleIdByName(roleName): Promise<number | null> {
    const role = await this.db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.name, roleName))
      .limit(1);

    return role.length > 0 ? role[0].id : null;
  }

  async updateProfileFields(
    userId: string,
    fields: { first_name?: string; last_name?: string; phone?: string }
  ) {
    // Only update provided fields
    const updateData: Record<string, any> = {};
    if (fields.first_name) updateData.first_name = fields.first_name;
    if (fields.last_name) updateData.last_name = fields.last_name;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException("No fields to update");
    }

    const updatedUser = await this.db
      .update(schema.users)
      .set(updateData)
      .where(eq(schema.users.id, +userId))
      .returning();

    return updatedUser[0];
  }

  async confirmPreviousPhone(userId, phone: string) {
    const user = await this.db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.id, userId), eq(schema.users.phone, phone)))
      .limit(1);

    if (!user || !user.length) {
      throw new UnauthorizedException("Phone number does not match");
    }

    // if phone number is not valid format tell the user to contact support
    if (!this.isValidPhone(phone)) {
      throw new BadRequestException(
        "Invalid phone number format, please contact support for assistance"
      );
    }

    // send message of code generated to the previous phone number
    const savedToken = await this.saveVerificationToken(userId);

    if (!savedToken) {
      return null;
    }

    return savedToken;
  }
}
