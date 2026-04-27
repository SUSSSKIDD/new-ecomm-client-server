import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Required for Razorpay webhook @RawBody() decorator
  });

  app.use(helmet());
  app.use(
    compression({
      threshold: 1024, // Only compress responses > 1KB
      level: 6, // Balanced speed vs compression ratio
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : [
          'http://localhost:5173',
          'http://localhost:3000',
          'https://new-ecomm-client.vercel.app',
          'https://localhost',
          'capacitor://localhost',
        ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('NEYOKART API')
    .setDescription('The NEYOKART Hyper-Local API description')
    .setVersion('1.0')
    .addTag('auth')
    .addTag('users')
    .addTag('products')
    .addTag('search')
    .addTag('cart')
    .addTag('orders')
    .addTag('payments')
    .addTag('stores')
    .addTag('delivery')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
