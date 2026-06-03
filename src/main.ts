import * as dotenv from 'dotenv';
dotenv.config();
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import morgan from 'morgan';
import { IoAdapter } from '@nestjs/platform-socket.io';



async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useWebSocketAdapter(new IoAdapter(app));

  app.use(morgan('dev'));
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('ConnectRun')
    .setDescription('ConnectRun App API Endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
    },
  });

  const port = Number(process.env.PORT) || 3010;
  await app.listen(port, () => {
    console.log(`🚀 Server running: http://localhost:${port}`);
    console.log(`📄 Swagger Docs: http://localhost:${port}/api/docs`);
  });
}

bootstrap();
