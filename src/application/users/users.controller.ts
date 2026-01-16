import { Controller, Body, UseInterceptors } from "@nestjs/common";
import { CustomResponseInterceptor } from "@/interceptors/api-response.interceptor";

@Controller("users")
@UseInterceptors(CustomResponseInterceptor)
export class UsersController {
  constructor() {}
}
