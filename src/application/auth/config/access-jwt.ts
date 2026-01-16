import { registerAs } from "@nestjs/config";
import { JwtModuleOptions } from "@nestjs/jwt";

export default registerAs("jwt", (): JwtModuleOptions => {
  const secret = process.env.JWT_ACCESS_SECRET;
  const expiresIn = process.env.JWT_ACCESS_EXPIRATION || "60s";

  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not defined in environment variables");
  }

  return {
    secret,
    signOptions: {
      expiresIn: expiresIn as any,
    },
  };
});
