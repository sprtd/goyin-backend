import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { FilesService } from "@/application/files/files.service";
import { DATABASE_CONNECTION } from "@/infrastructure/database/database.provider";
import type { Drizzle } from "@/interfaces/types/drizzle";
import { signed_csv, users_survey } from "@/infrastructure/persistence";
import { eq, and, sql, desc, like, SQL } from "drizzle-orm";
import { SurveyQueryDto } from "./dtos/survey-query.dto";

interface CsvRecord {
  [key: string]: string;
}

@Injectable()
export class SurveySyncService {
  private readonly logger = new Logger(SurveySyncService.name);

  constructor(
    private readonly filesService: FilesService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: Drizzle
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async syncCsvDataNightly() {
    this.logger.log("🚀 Starting nightly CSV sync...");
    console.log("🚀 Starting nightly CSV sync...");
    try {
      let grandTotalProcessed = 0;
      let grandTotalDuplicates = 0;

      // Process users surveys
      const usersStats = await this.processCsvsByType("users");
      grandTotalProcessed += usersStats.totalProcessed;
      grandTotalDuplicates += usersStats.totalDuplicates;

      // Process drivers surveys
      const driversStats = await this.processCsvsByType("drivers");
      grandTotalProcessed += driversStats.totalProcessed;
      grandTotalDuplicates += driversStats.totalDuplicates;

      this.logger.log(
        `✅ Nightly sync complete. Total inserted: ${grandTotalProcessed}, Total duplicates: ${grandTotalDuplicates}`
      );
    } catch (err) {
      this.logger.error(`❌ Nightly sync failed: ${err}`);
    }
  }

  private async processCsvsByType(
    type: "users" | "drivers"
  ): Promise<{ totalProcessed: number; totalDuplicates: number }> {
    const prefix = `csv/${type}/`;
    this.logger.log(`🔄 Processing ${type} surveys...`);

    try {
      // List all CSV files in R2 for this type
      const allCsvFiles = await this.filesService.listCsvFiles("desc");

      // Filter by prefix OR by filename pattern for backward compatibility
      const csvFiles = allCsvFiles.filter((f) => {
        if (!f.key) return false;

        // Check if file is in the new structured path (csv/users/ or csv/drivers/)
        if (f.key.startsWith(prefix)) return true;

        // For backward compatibility: check legacy files at csv/ root by filename pattern
        if (
          f.key.startsWith("csv/") &&
          !f.key.includes("/users/") &&
          !f.key.includes("/drivers/")
        ) {
          const filename = f.key.toLowerCase();
          if (type === "users" && (filename.includes("users") || filename.includes("user"))) {
            return true;
          }
          if (type === "drivers" && (filename.includes("drivers") || filename.includes("driver"))) {
            return true;
          }
        }

        return false;
      });

      this.logger.log(`Found ${csvFiles.length} ${type} CSV files`);
      if (!csvFiles.length) {
        this.logger.debug(
          `No ${type} CSVs matched. Keys seen: ${allCsvFiles.map((f) => f.key).join(", ")}`
        );
      }

      let totalProcessed = 0;
      let totalDuplicates = 0;

      for (const csvFile of csvFiles) {
        const { key, lastModified } = csvFile;
        if (!key) continue;

        // Check if this file has already been processed
        const existingRecord = await this.db
          .select()
          .from(signed_csv)
          .where(eq(signed_csv.csv_key, key))
          .limit(1);

        // If file hasn't changed, skip it
        if (existingRecord.length > 0) {
          const lastSync = existingRecord[0].last_sync_at?.getTime() ?? 0;
          const fileModified = lastModified ?? 0;
          const processedCount = existingRecord[0].processed_count ?? 0;

          // Only skip if previously processed and file has not changed
          if (processedCount > 0 && fileModified > 0 && fileModified <= lastSync) {
            this.logger.debug(`Skipping unchanged file: ${key}`);
            continue;
          }
        }

        this.logger.log(`Processing CSV: ${key}`);

        try {
          // Fetch and parse CSV
          const records = await this.filesService.getCsvRecords(key);
          this.logger.log(`Fetched ${records.length} records from ${key}`);

          // Debug: log first 3 records and their structure
          if (records.length > 0) {
            const firstRecord = records[0];
            const headers = Object.keys(firstRecord);
            console.log(`🔍 HEADERS (${headers.length}):`, headers);
            console.log(`🔍 PHONE KEYS:`, headers.filter((h) => h.toLowerCase().includes("phone")));
            console.log(`🔍 FIRST RECORD "Phone Number: ":`, JSON.stringify(firstRecord["Phone Number: "]));
            console.log(`🔍 FIRST RECORD "Phone Number:":`, JSON.stringify(firstRecord["Phone Number:"]));
            console.log(`🔍 FIRST RECORD "Phone Number":`, JSON.stringify(firstRecord["Phone Number"]));
            this.logger.log(
              `🔍 First record headers: ${headers.join(" | ")}`
            );
            this.logger.log(
              `🔍 Sample first record phone fields: ${JSON.stringify({
                "Phone Number: ": firstRecord["Phone Number: "],
                "Phone Number:": firstRecord["Phone Number:"],
                "Phone Number": firstRecord["Phone Number"],
                Email: firstRecord["Email"],
                Name: firstRecord["Name"],
              })}`
            );
          }

          let processedCount = 0;
          let duplicateCount = 0;
          const errorLog: { row: number; reason: string; record: CsvRecord }[] = [];

          // Process each record
          for (let idx = 0; idx < records.length; idx++) {
            const record = records[idx];

            try {
              const result = await this.processRecord(record, type);

              if (result.isDuplicate) {
                duplicateCount++;
                errorLog.push({
                  row: idx + 1,
                  reason: result.reason || "Duplicate detected",
                  record,
                });
                this.logger.warn(
                  `Duplicate detected at row ${idx + 1}: ${result.reason} (${JSON.stringify({
                    email: record.Email,
                    phone: record["Phone Number: "] || record["Phone Number:"] || record["Phone Number"],
                  })})`
                );
              } else {
                processedCount++;
              }
            } catch (err) {
              errorLog.push({
                row: idx + 1,
                reason: err instanceof Error ? err.message : "Unknown error",
                record,
              });
              this.logger.error(`Error processing row ${idx + 1}: ${err}`);
            }
          }

          // Update or insert signed_csv record
          if (existingRecord.length > 0) {
            await this.db
              .update(signed_csv)
              .set({
                last_modified: lastModified ? new Date(lastModified) : null,
                processed_count: processedCount,
                duplicate_count: duplicateCount,
                error_log: errorLog.length > 0 ? errorLog : null,
                last_sync_at: new Date(),
                updated_at: new Date(),
              })
              .where(eq(signed_csv.csv_key, key));
          } else {
            await this.db.insert(signed_csv).values({
              csv_key: key,
              last_modified: lastModified ? new Date(lastModified) : null,
              processed_count: processedCount,
              duplicate_count: duplicateCount,
              error_log: errorLog.length > 0 ? errorLog : null,
              last_sync_at: new Date(),
            });
          }

          totalProcessed += processedCount;
          totalDuplicates += duplicateCount;

          this.logger.log(
            `Completed ${key}: ${processedCount} inserted, ${duplicateCount} duplicates`
          );
        } catch (err) {
          this.logger.error(`Failed to process CSV ${key}: ${err}`);
        }
      }

      this.logger.log(`${type} sync: ${totalProcessed} inserted, ${totalDuplicates} duplicates`);

      return { totalProcessed, totalDuplicates };
    } catch (err) {
      this.logger.error(`❌ ${type} sync failed: ${err}`);
      return { totalProcessed: 0, totalDuplicates: 0 };
    }
  }

  private async processRecord(
    record: CsvRecord,
    type: "users" | "drivers" = "users"
  ): Promise<{ isDuplicate: boolean; reason?: string }> {
    // Extract phone number from record (using respondent's phone, not agent's)
    // Try multiple possible header variants: "Phone Number: ", "Phone Number:", "Phone Number"
    const rawPhone = (
      record["Phone Number: "] ||
      record["Phone Number:"] ||
      record["Phone Number"] ||
      ""
    ).trim();

    // Normalize phone to +234 format
    const phone = this.normalizePhoneNumber(rawPhone);

    // Skip if phone is invalid/empty
    if (!phone) {
      this.logger.debug(`Skipping record - invalid phone: "${rawPhone}"`);
      return {
        isDuplicate: true,
        reason: "No valid phone number provided",
      };
    }

    // Determine role (survey type discriminator: user or driver)
    const role = type === "drivers" ? "driver" : "user";

    // Extract profession (actual job) from record
    const profession = (record["Profession"] || "").trim().toLowerCase() || null;

    // Check for existing phone (uniqueness per survey type)
    const existingByPhone = await this.db
      .select()
      .from(users_survey)
      .where(and(eq(users_survey.role, role), eq(users_survey.phone, phone)))
      .limit(1);

    if (existingByPhone.length > 0) {
      this.logger.debug(
        `Duplicate found - Phone: ${phone}, Role: ${role}, Existing ID: ${existingByPhone[0].id}`
      );
      return {
        isDuplicate: true,
        reason: `Duplicate phone (${phone}) for ${role} survey`,
      };
    }

    // Store email for reference but don't use for deduplication
    const emailBase = (record["Email"] || record.Email || "").trim();
    const email = emailBase ? emailBase.toLowerCase() : null;

    this.logger.debug(
      `Inserting new record - Phone: ${phone}, Role: ${role}, Name: ${record.Name || record["Driver Name"]}`
    );

    // Insert new record
    await this.db.insert(users_survey).values({
      role,
      profession,
      email,
      phone,
      name: (record.Name || record["Driver Name"] || "").trim() || null,
      raw_data: record,
      is_duplicate: 0,
    });

    return { isDuplicate: false };
  }

  /**
   * Normalize phone number to +234 format
   * Handles: 0803..., 803..., +234803..., 234803...
   */
  private normalizePhoneNumber(rawPhone: string): string | null {
    if (!rawPhone) return null;

    // Remove all non-digits
    const digits = rawPhone.replace(/\D/g, "");

    if (!digits) return null;

    // Handle different formats
    if (digits.startsWith("234")) {
      // Already has country code: 234803... -> +234803...
      return `+${digits}`;
    } else if (digits.startsWith("0")) {
      // Local format with leading 0: 0803... -> +234803...
      return `+234${digits.substring(1)}`;
    } else if (digits.length >= 10) {
      // Assume missing leading 0: 803... -> +234803...
      return `+234${digits}`;
    }

    // Invalid format
    return null;
  }

  async getLastSyncStatus() {
    const lastSync = await this.db.select().from(signed_csv).orderBy(signed_csv.last_sync_at);
    return lastSync;
  }

  async getSyncStats() {
    const stats = await this.db
      .select({
        total_processed: sql<number>`sum(${signed_csv.processed_count})`,
        total_duplicates: sql<number>`sum(${signed_csv.duplicate_count})`,
      })
      .from(signed_csv);

    return stats[0] || { total_processed: 0, total_duplicates: 0 };
  }

  async findAll(query: SurveyQueryDto) {
    const { type, phone, email, page = 1, limit = 20 } = query;
    const offset = (page - 1) * limit;

    const whereConditions: SQL[] = [];

    if (type) {
      whereConditions.push(eq(users_survey.role, type));
    }

    if (phone) {
      // Normalize or just simple partial match?
      // Since phone is stored normalized (+234...), better to assume input query might be partial.
      whereConditions.push(like(users_survey.phone, `%${phone}%`));
    }

    if (email) {
      whereConditions.push(like(users_survey.email, `%${email}%`));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [data, totalCountResult] = await Promise.all([
      this.db
        .select()
        .from(users_survey)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(users_survey.created_at)),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(users_survey)
        .where(whereClause),
    ]);

    const total = Number(totalCountResult[0]?.count || 0);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMetrics() {
    // 1. Total count
    const totalCountResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users_survey);
    const totalSurveys = Number(totalCountResult[0]?.count || 0);

    // 2. Count by Type (Role)
    const byRole = await this.db
      .select({
        role: users_survey.role,
        count: sql<number>`count(*)::int`,
      })
      .from(users_survey)
      .groupBy(users_survey.role);

    // 3. Count by Agent (assuming 'Agent Name' in raw_data)
    // We try to extract common agent keys: "Agent Name", "Enumerator Name"
    // Note: This relies on the specific CSV structure.
    const byAgent = await this.db
      .select({
        agent: sql<string>`COALESCE(
          ${users_survey.raw_data}->>'Agent Name',
          ${users_survey.raw_data}->>'Enumerator Name',
          ${users_survey.raw_data}->>'Interviewer Name',
          'Unknown'
        )`,
        count: sql<number>`count(*)::int`,
      })
      .from(users_survey)
      .groupBy(sql`COALESCE(
          ${users_survey.raw_data}->>'Agent Name',
          ${users_survey.raw_data}->>'Enumerator Name',
          ${users_survey.raw_data}->>'Interviewer Name',
          'Unknown'
        )`)
      .orderBy(sql`count(*)::int DESC`);

    return {
      totalSurveys,
      byRole,
      byAgent,
    };
  }
}
