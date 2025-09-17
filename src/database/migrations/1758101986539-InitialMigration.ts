import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1758101986539 implements MigrationInterface {
  name = 'InitialMigration1758101986539';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "first_name" character varying(100) NOT NULL, "last_name" character varying(100) NOT NULL, "birthday" date NOT NULL, "timezone" character varying(50) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_21ca897cc5bae77a77d8968a06" ON "users" ("birthday", "timezone") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_logs_event_type_enum" AS ENUM('birthday', 'anniversary')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_logs_status_enum" AS ENUM('pending', 'sent', 'failed', 'retry')`,
    );
    await queryRunner.query(
      `CREATE TABLE "event_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "event_type" "public"."event_logs_event_type_enum" NOT NULL, "event_year" integer NOT NULL, "status" "public"."event_logs_status_enum" NOT NULL DEFAULT 'pending', "sent_at" TIMESTAMP, "retry_count" integer NOT NULL DEFAULT '0', "error_message" text, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b09cf1bb58150797d898076b242" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_82fa50d0394f4d90b42dfc050b" ON "event_logs" ("status", "created_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4d7831f8a50253c0c7e59f82f0" ON "event_logs" ("user_id", "event_type", "event_year") `,
    );
    await queryRunner.query(
      `ALTER TABLE "event_logs" ADD CONSTRAINT "FK_214c8c693849f8f41a41391939b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_logs" DROP CONSTRAINT "FK_214c8c693849f8f41a41391939b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4d7831f8a50253c0c7e59f82f0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_82fa50d0394f4d90b42dfc050b"`,
    );
    await queryRunner.query(`DROP TABLE "event_logs"`);
    await queryRunner.query(`DROP TYPE "public"."event_logs_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."event_logs_event_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_21ca897cc5bae77a77d8968a06"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
