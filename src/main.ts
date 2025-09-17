import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger documentation: /api
  const config = new DocumentBuilder()
    .setTitle('Rooster Birthday Reminder API')
    .setDescription('Simple birthday reminder service with timezone support')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Bull Dashboard Setup: /admin/queues
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [
      new BullAdapter(app.get('BullQueue_notification')),
      new BullAdapter(app.get('BullQueue_event-processing')),
    ],
    serverAdapter,
  });
  app.use('/admin/queues', serverAdapter.getRouter());

  // start api
  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`API is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation: http://localhost:${port}/api`);
}

bootstrap();
