import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { catchError, map } from "rxjs/operators";

@Injectable()
export class CustomResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const statusCode = context.switchToHttp().getResponse().statusCode;
    const response = context.switchToHttp().getResponse();
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      map((data) => {
        // Ensure data is an object before checking for properties
        if (
          data &&
          typeof data === "object" &&
          "statusCode" in data &&
          "data" in data &&
          "message" in data
        ) {
          return data;
        }
        return {
          statusCode,
          message: statusCode >= 400 ? "Error" : "Success",
          error: statusCode >= 400 ? response.message : null,
          timestamp: Date.now(),
          version: "v1",
          path: request.url,
          data: statusCode >= 400 ? null : data, // Ensure data is not nested for success responses
        };
      }),
      catchError((err) => {
        let statusCode = err instanceof HttpException ? err.getStatus() : 500;
        let message = err.message || "Internal server error";

        // Check for database constraint violation
        if (err.message?.includes("violates foreign key constraint")) {
          statusCode = HttpStatus.BAD_REQUEST;
          message = "Invalid reference: The referenced event does not exist";
        }

        const errorResponse = {
          statusCode,
          message,
          error: err.name || "Error",
          timestamp: Date.now(),
          version: "v1",
          path: request.url,
          data: err?.response, // Ensure data is null in case of error
        };

        return throwError(() => new HttpException(errorResponse, statusCode));
      })
    );
  }
}
