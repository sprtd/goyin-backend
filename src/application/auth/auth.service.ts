import { ResendOtpDto, VerifyOtpDto } from "./dto/verify-user.dto";
import { IUser } from "../../interfaces/types/users/user.type";
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { UsersService } from "../users/users.service";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AllowedRoles } from "./dto/sign-up.dto";
import { ChangePasswordDto, ForgotPasswordChangeDto } from "./dto/password-dto";
import type { JwtPayload, RoleNameType } from "@/interfaces/types/users";
import { SignInDto } from "./dto/sign-in.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Helper function to check if the result has user and savedToken properties
  // private isUserCreationSuccess(result: any): result is {
  //   user: any[] | QueryResult<never>;
  //   savedToken: { token: string }[];
  // } {
  //   return result && 'user' in result && 'savedToken' in result;
  // }

  async signUp(createUserDto: any) {
    const result = await this.usersService.create({
      ...createUserDto,
    });

    // Check if result has the expected structure
    if (result && result.user && result.user[0] && result.savedToken && result.savedToken[0]) {
      const userResponse = result.user[0];
      const tokenResponse = result.savedToken[0];
      // send email
      // this.eventEmitter.emit('user.verification', {
      //   ...userResponse,
      //   ...tokenResponse,
      // });
      if (!createUserDto || createUserDto.verify_via === "email") {
        this.eventEmitter.emit("user.verification", {
          ...userResponse,
          ...tokenResponse,
        });
      } else if (createUserDto.verify_via === "phone") {
        // Send whatsapp verification code
        this.eventEmitter.emit("user.verification.whatsapp", {
          ...userResponse,
          ...tokenResponse,
          phone: createUserDto.phone,
        });
      }

      return {
        message: "Please verify your email",
        action: "verify_email",
        data: {
          first_name: userResponse.first_name,
          last_name: userResponse.last_name,
          email: userResponse.email,
        },
      };
    } else {
      // Handle the error case - result is { message: string; code: string; }
      throw new InternalServerErrorException("Failed to create user");
    }
  }

  private async generateTokens(payload: JwtPayload) {
    const accessPayload = await this.jwtService.signAsync(payload);
    const refreshTokenOptions = this.configService.get<JwtSignOptions>("refresh-jwt");
    const refreshPayload = await this.jwtService.signAsync(payload, refreshTokenOptions);
    const updatedUser = await this.usersService.upsertRefreshToken(payload.sub, refreshPayload);

    if (!updatedUser) {
      throw new InternalServerErrorException("unknown error");
    }

    return { accessPayload, refreshPayload };
  }
  async signIn(signInDto: SignInDto) {
    const { email, password: user_password, role = "host", phone, new_role } = signInDto;

    if (!email && !phone) {
      throw new BadRequestException("Either email or phone must be provided");
    }

    if (email && !this.usersService.isValidEmail(email)) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (phone && !this.usersService.isValidPhone(phone)) {
      throw new UnauthorizedException("Invalid credentials");
    }

    let userExists;

    if (email) {
      userExists = await this.usersService.findByEmail(email);
    } else if (phone) {
      userExists = (await this.usersService.findByPhone(phone)) as unknown as IUser;
    }

    if (!userExists) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Handle phone number verification
    if (phone && !userExists.phone) {
      throw new UnauthorizedException("Please update your phone number to use phone login");
    }

    // Handle phone number comparison (considering country code)
    // Handle phone number comparison (considering country code)
    if (phone && userExists.phone) {
      if (!this.usersService.hasCountryCode(phone)) {
        throw new UnauthorizedException(
          "Please provide the country code with your phone number (e.g., +234)"
        );
      }

      const normalizedInputPhone = this.usersService.normalizePhoneNumber(phone);
      const normalizedStoredPhone = this.usersService.normalizePhoneNumber(userExists.phone);

      if (normalizedInputPhone !== normalizedStoredPhone) {
        throw new UnauthorizedException("Invalid credentials");
      }
    }

    // Password verification
    const storedPassword = this.getStoredPassword(userExists);

    if (!storedPassword || typeof storedPassword !== "string") {
      throw new UnauthorizedException("Invalid credentials");
    }

    const unHashedPassword = await this.usersService.comparePassword(user_password, storedPassword);

    if (!unHashedPassword) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const { password, ...result } = userExists;

    // if user is not verified, handle the unverified user case
    if (!result.is_verified) {
      return {
        message: "Please verify your email",
        user: {
          first_name: result.first_name,
          last_name: result.last_name,
        },
      };
    }

    const userRoles = await this.usersService.getUserRolesViaEmail(userExists.email);
    // console.log('🚀 ~ AuthService ~ signIn ~ userRoles:', userRoles);

    if (role) {
      const hasRole = userRoles.some((userRole) => userRole.role_name === role);
      // console.log('🚀 ~ AuthService ~ signIn ~ hasRole:', hasRole);
      // console.log('🚀 ~ AuthService ~ signIn ~ new_role:', new_role);

      if (userRoles.length > 0 && !hasRole) {
        if (new_role === true) {
          // User exists but wants to add a new role
          const result = await this.usersService.addNewRoleToUser(
            userExists,
            role as unknown as AllowedRoles
          );

          if (!result) {
            throw new InternalServerErrorException("Failed to add role");
          }

          const payload: JwtPayload = {
            sub: userExists.id,
            email: userExists.email,
            role: {
              id: result.role[0].role_id,
              name: role as RoleNameType,
            },
          };

          // JWT generation
          const signedResult = await this.generateTokens(payload);

          return {
            access_token: signedResult.accessPayload,
            refresh_token: signedResult.refreshPayload,
            role: role,
          };
        }

        // User exists but doesn't have the specified role
        return {
          message: "User exists with different role. Do you want to add this role?",
          action: "confirm_new_role",
          userId: userExists.id,
          newRole: role,
        };
      } else if (userRoles.length === 0) {
        // User exists but has no roles assigned
        const result = await this.usersService.addNewRoleToUser(
          userExists,
          role as unknown as AllowedRoles
        );

        // mock the endgame here too
        if (!result) {
          throw new InternalServerErrorException("Failed to add role");
        }

        const payload: JwtPayload = {
          sub: userExists.id,
          email: userExists.email,
          role: {
            id: result.role[0].role_id,
            name: role as RoleNameType,
          },
        };

        // JWT generation
        const signedResult = await this.generateTokens(payload);

        return {
          access_token: signedResult.accessPayload,
          refresh_token: signedResult.refreshPayload,
          role: role,
        };
      }

      const activeRole = role
        ? userRoles.find((role_in) => role_in.role_name === (role as RoleNameType))
        : undefined;

      if (!activeRole) {
        throw new UnauthorizedException("Invalid role for this user");
      }

      const payload: JwtPayload = {
        sub: result.id,
        email: result.email,
        role: {
          id: activeRole.role_id,
          name: activeRole.role_name as RoleNameType,
        },
      };

      if (!result.is_verified) {
        return this.handleUnverifiedUser(result);
      }

      // JWT generation
      const signedResult = await this.generateTokens(payload);

      return {
        access_token: signedResult.accessPayload,
        refresh_token: signedResult.refreshPayload,
        role: activeRole.role_name,
      };
    }
  }
  private getStoredPassword(user: IUser): string | null {
    return typeof user.password === "object" && user.password !== null
      ? (user.password as unknown as { toString(): string }).toString()
      : user.password;
  }

  private async handleUnverifiedUser(user: Partial<IUser>) {
    const checkRetryCount = await this.usersService.checkEmailRetrys(user.id);
    if (!checkRetryCount) {
      return "Too many retries, please try again in 1hr or contact support for assistance";
    }
    const saveVerificationToken = await this.usersService.saveVerificationToken(user.id);
    if (!saveVerificationToken) {
      throw new InternalServerErrorException("unknown error");
    }
    // send email
    this.eventEmitter.emit("user.verification", {
      ...user,
      token: saveVerificationToken,
    });
    return "Please verify your email";
  }

  async verifyUser(verifyOtpDto: VerifyOtpDto) {
    const verifiedUser = (await this.usersService.verifyToken({
      ...verifyOtpDto,
    })) as unknown as IUser;
    const payload: JwtPayload = {
      sub: verifiedUser[0].id,
      email: verifiedUser[0].email,
      role: verifiedUser[0].role,
    };

    const signedResult = await this.generateTokens(payload);

    // send welcome email here
    this.eventEmitter.emit("user.welcome", {
      ...verifiedUser[0],
    });

    return {
      message: "user verified successfully",
      access_token: signedResult.accessPayload,
      refresh_token: signedResult.refreshPayload,
    };
  }

  async resendToken(resendotpDto: ResendOtpDto) {
    try {
      const { email, phone } = resendotpDto;
      if (!email && !phone) {
        throw new BadRequestException("Either email or phone must be provided");
      }

      if (email && !this.usersService.isValidEmail(email)) {
        throw new UnauthorizedException("Invalid credentials");
      }

      if (phone && !this.usersService.isValidPhone(phone)) {
        throw new UnauthorizedException("Invalid credentials");
      }

      let userExists;

      if (!email && !phone) {
        throw new BadRequestException("Either email or phone must be provided");
      }

      if (email && !this.usersService.isValidEmail(email)) {
        throw new UnauthorizedException("Invalid credentials");
      }

      if (phone && !this.usersService.isValidPhone(phone)) {
        throw new UnauthorizedException("Invalid credentials");
      }

      if (email) {
        userExists = await this.usersService.findByEmail(email);
      } else if (phone) {
        userExists = (await this.usersService.findByPhone(phone)) as unknown as IUser;
      }

      if (!userExists) {
        throw new UnauthorizedException("Invalid credentials");
      }

      // Handle phone number comparison (considering country code)
      if (phone && userExists.phone) {
        if (!this.usersService.hasCountryCode(phone)) {
          throw new UnauthorizedException(
            "Please provide the country code with your phone number (e.g., +234)"
          );
        }

        const normalizedInputPhone = this.usersService.normalizePhoneNumber(phone);
        const normalizedStoredPhone = this.usersService.normalizePhoneNumber(userExists.phone);

        if (normalizedInputPhone !== normalizedStoredPhone) {
          throw new UnauthorizedException("Invalid credentials");
        }
      }

      const result = await this.usersService.resendToken(userExists);

      // send email if the email is provided else send a whats app message if the phone is provided
      if (email) {
        this.eventEmitter.emit("user.verification", {
          ...result,
          email: userExists.email,
        });
      } else if (phone) {
        this.eventEmitter.emit("user.verification.whatsapp", {
          ...result,
          phone: userExists.phone,
        });
      }
      return { message: "token successfully resent" };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async forgotPasswordEmailVerification(email: ResendOtpDto) {
    const result = (await this.usersService.forgotPasswordEmailVerification(
      email
    )) as unknown as Record<string, string>;

    if (result.code && result.code === "429") {
      return result.message;
    }

    // send email
    this.eventEmitter.emit("user.verification", { ...result });
    return "token successfully resent";
  }

  async forgotPasswordNewPassword(forgotPassword: ForgotPasswordChangeDto) {
    const result = await this.usersService.confirmForgotPasswordToken(forgotPassword);

    return "password successfully changed, proceed to login";
  }

  async changePassword(user: JwtPayload, payload: ChangePasswordDto) {
    // generate a new refresh token
    const refreshTokenOptions = this.configService.get<JwtSignOptions>("refresh-jwt");

    const refreshPayload = await this.jwtService.signAsync(
      { sub: user.sub, email: user.email },
      refreshTokenOptions
    );

    await this.usersService.changePassword({ ...user, refresh_token: refreshPayload }, payload);
    return {
      message: "password successfully changed",
      refresh_token: refreshPayload,
    };
  }

  async userSession(user: JwtPayload) {
    const currentUser = await this.usersService.findByEmail(user.email);

    const { password, ...result } = currentUser;

    const next = result;

    const { refresh_token, ...rest } = next;

    // send a new access token
    // const payload: JwtPayload = {
    //   sub: result.id,
    //   email: result.email,
    //   role: {
    //     id: user.role.id,
    //     name: user.role.name as RoleNameType,
    //   },
    // };

    // const accessPayload = await this.jwtService.signAsync(payload);
    // for phone check if the user has uploaded it could be null or start with +3333 which is the dummy phone assigned to users who do not upload the phone

    return {
      ...rest,
      phone: !rest.phone || rest.phone.startsWith("+3333") ? null : rest.phone,
      // profile_image: await this.usersService.fetchUserProfilePictureById(rest.user_profile),
      decoded: {
        ...user,
      },
    };
  }

  async refreshSession(user: JwtPayload & { token: string }) {
    // check if the user exists
    const userExists = await this.usersService.findByEmail(user.email);

    if (!userExists) {
      throw new UnauthorizedException("unauthorized");
    }

    // find check if the token from request equals the saved token in database

    if (typeof user.token !== "string" || typeof userExists.refresh_token !== "object") {
      throw new UnauthorizedException("Invalid token format");
    }

    if (!userExists.refresh_token || Object.keys(userExists.refresh_token).length === 0) {
      throw new UnauthorizedException("No refresh token found");
    }

    const savedTokens = Object.values(userExists.refresh_token);
    const tokenExists = savedTokens.includes(user.token);

    if (!tokenExists) {
      throw new UnauthorizedException("Unauthorized: Token not found");
    }

    // If we reach here, the token is valid
    const { token, ...rest } = user;
    // generate a new refresh token for the user
    const accessPayload = await this.jwtService.signAsync({
      sub: rest.sub,
      email: rest.email,
      role: rest.role,
    });

    return {
      access_token: accessPayload,
    };
  }

  updateProfile(
    user: JwtPayload,
    body: { first_name?: string; last_name?: string; phone?: string }
  ) {
    return this.usersService.updateProfileFields(user.sub, body);
  }

  async confirmPreviousPhone(user: JwtPayload, body: { phone: string }) {
    const savedToken = await this.usersService.confirmPreviousPhone(user.sub, body.phone);

    if (savedToken || savedToken === null) {
      // send whatsapp verification code
      this.eventEmitter.emit("user.verification.whatsapp", {
        ...user,
        phone: body.phone,
        token: savedToken,
      });
    }

    return { message: "An otp has been sent to the phone number provided" };
  }
}
