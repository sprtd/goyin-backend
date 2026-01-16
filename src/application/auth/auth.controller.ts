import {
  Controller,
  Get,
  Post,
  Body,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  UploadedFile,
  Req,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { SignInType } from "./dto/sign-in.dto";
import { CustomResponseInterceptor } from "@/interceptors/api-response.interceptor";
import { AuthGuard } from "./guards/auth.guards";
import { CurrentUser } from "./decorators/current-user.decorator";
import { ResendOtpDto, ResendOtpType, VerifyOtpDto, VerifyOtpType } from "./dto/verify-user.dto";
import { ZodError } from "zod";
import type { JwtPayload } from "@/interfaces/types/users/jwt.type";
// import { validateDto } from '@/shared/helpers/validation-helper';
import { AllowedRoles, CreateUserDto, CreateUserType } from "./dto/sign-up.dto";
import {
  ChangePasswordDto,
  ChangePasswordType,
  ForgotPasswordChangeDto,
  ForgotPasswordChangeType,
} from "./dto/password-dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { RefreshAuthGuard } from "./guards/refresh.guards";
import { CurrentRefreshUser } from "./decorators/current-user-refresh.decorator";
import {
  CreateUserExistingUserDto,
  CreateUserTypeExistingUser,
} from "./dto/sign-up-existing-user.dto";

@Controller("auth")
@UseInterceptors(CustomResponseInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("sign-up")
  signUp(@Body() createUserDto: CreateUserDto) {
    const validatedDto = CreateUserType.parse(createUserDto);
    return this.authService.signUp(validatedDto);
  }

  @Post("sign-in")
  create(@Body() rawSignInDto: any) {
    const signInDto = {
      ...rawSignInDto,
      new_role: rawSignInDto.new_role === "true" || rawSignInDto.new_role === true,
    };
    console.log("🚀 ~ AuthController ~ create ~ signInDto:", signInDto);
    try {
      SignInType.parse(signInDto);
      return this.authService.signIn(signInDto);
    } catch (error) {
      console.log("🚀 ~ AuthController ~ create ~ error:", error);
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      throw new BadRequestException("Validation failed");
    }
  }

  @Post("verify-user")
  // @UseGuards(AuthGuard)
  verifyUser(@Body() verifyOtpDto: VerifyOtpDto) {
    try {
      VerifyOtpType.parse(verifyOtpDto);
      return this.authService.verifyUser(verifyOtpDto);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      throw new BadRequestException("Validation failed");
    }
  }
  @Post("resend-otp")
  resendOtp(@Body() resendOtpDto: ResendOtpDto) {
    try {
      ResendOtpType.parse(resendOtpDto);

      return this.authService.resendToken(resendOtpDto);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      throw new BadRequestException("Validation failed");
    }
  }
  @Post("forgot-password/confirm-email")
  forgotPasswordConfirmEmail(@Body() confirmEmail: ResendOtpDto) {
    try {
      ResendOtpType.parse(confirmEmail);

      return this.authService.forgotPasswordEmailVerification(confirmEmail);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      throw new BadRequestException("Validation failed");
    }
  }

  @Post("forgot-password/new-password")
  forgotPasswordNewPassword(@Body() forgotPasswordDto: ForgotPasswordChangeDto) {
    try {
      ForgotPasswordChangeType.parse(forgotPasswordDto);

      return this.authService.forgotPasswordNewPassword(forgotPasswordDto);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      throw new BadRequestException("Validation failed");
    }
  }

  @Post("change-password")
  @UseGuards(AuthGuard)
  changePassword(@CurrentUser() user: JwtPayload, @Body() changePasswordDto: ChangePasswordDto) {
    try {
      ChangePasswordType.parse(changePasswordDto);

      return this.authService.changePassword(user, changePasswordDto);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      throw new BadRequestException("Validation failed");
    }
  }

  @Get("user-session")
  @UseGuards(AuthGuard)
  getUserSession(@CurrentUser() user: JwtPayload) {
    console.log("🚀 ~ AuthController ~ getUserSession ~ user:", user);
    return this.authService.userSession(user);
  }

  @Post("refresh")
  @UseGuards(RefreshAuthGuard)
  refreshToken(@CurrentRefreshUser() user: JwtPayload & { token: string }) {
    return this.authService.refreshSession(user);
  }

  @Post("update-profile")
  @UseGuards(AuthGuard)
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() body: { first_name?: string; last_name?: string }
  ) {
    return this.authService.updateProfile(user, body);
  }

  @Post("verify-previous-phone")
  @UseGuards(AuthGuard)
  updatePhone(@CurrentUser() user: JwtPayload, @Body() body: { phone: string }) {
    return this.authService.confirmPreviousPhone(user, body);
  }
}
