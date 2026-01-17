import {
  Controller,
  Get,
  Query,
  Param,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { SurveySyncService } from "./survey-sync.service";
import { SurveyQuerySchema } from "./dtos/survey-query.dto";
import { ZodError } from "zod";

@Controller("admin/survey-sync")
export class SurveyController {
  private readonly logger = new Logger(SurveyController.name);

  constructor(private readonly surveySyncService: SurveySyncService) {}

  @Get()
  async findAll(@Query() query: unknown) {
    try {
      const validatedQuery = SurveyQuerySchema.parse(query);
      return await this.surveySyncService.findAll(validatedQuery);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      this.logger.error(`Validation error: ${error}`);
      throw new BadRequestException("Validation failed");
    }
  }

  @Get("metrics")
  async getMetrics() {
    return await this.surveySyncService.getMetrics();
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    const survey = await this.surveySyncService.findOne(+id);
    if (!survey) {
      throw new NotFoundException(`Survey with ID ${id} not found`);
    }
    return survey;
  }
}
