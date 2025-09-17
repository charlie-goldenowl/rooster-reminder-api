import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';

export abstract class BaseSeeder {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly dataSource: DataSource) {}

  abstract run(): Promise<void>;

  protected async clearTable(tableName: string): Promise<void> {
    this.logger.log(`Clearing table: ${tableName}`);
    await this.dataSource.query(`DELETE FROM ${tableName}`);
    await this.dataSource.query(
      `ALTER SEQUENCE ${tableName}_id_seq RESTART WITH 1`,
    );
  }

  protected async resetSequence(tableName: string): Promise<void> {
    await this.dataSource.query(
      `ALTER SEQUENCE ${tableName}_id_seq RESTART WITH 1`,
    );
  }
}
