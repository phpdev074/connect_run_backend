import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.cleanEnvValue(this.configService.get<string>('FIREBASE_PROJECT_ID'));
    const clientEmail = this.cleanEnvValue(this.configService.get<string>('FIREBASE_CLIENT_EMAIL'));
    const privateKey = this.cleanPrivateKey(this.configService.get<string>('FIREBASE_PRIVATE_KEY'));

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.error('Firebase credentials are not fully defined in .env');
      return;
    }

    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        this.logger.log(`Firebase Admin SDK initialized successfully. projectId=${projectId} clientEmail=${clientEmail}`);
      }
    } catch (error) {
      this.logger.error('Error initializing Firebase Admin SDK', error.stack);
    }
  }

  async sendPushNotification(token: string, title: string, body: string, data?: any) {
    if (!token) {
      this.logger.warn('No token provided for push notification');
      return;
    }

    const message: admin.messaging.Message = {
      notification: {
        title,
        body,
      },
      data: data || {},
      token,
    };

    try {
      const response = await admin.messaging().send(message);
      this.logger.log(`Successfully sent message: ${response}`);
      return response;
    } catch (error) {
      this.logger.error(
        `Error sending push notification. code=${error?.code || 'unknown'} message=${error?.message || 'unknown'}`,
        error.stack,
      );
      throw error;
    }
  }

  async sendToTopic(topic: string, title: string, body: string, data?: any) {
    const message: admin.messaging.Message = {
      notification: {
        title,
        body,
      },
      data: data || {},
      topic,
    };

    try {
      const response = await admin.messaging().send(message);
      this.logger.log(`Successfully sent message to topic ${topic}: ${response}`);
      return response;
    } catch (error) {
      this.logger.error(
        `Error sending push notification to topic ${topic}. code=${error?.code || 'unknown'} message=${error?.message || 'unknown'}`,
        error.stack,
      );
      throw error;
    }
  }

  private cleanEnvValue(value?: string) {
    return value?.trim().replace(/^['"]|['"]$/g, '');
  }

  private cleanPrivateKey(value?: string) {
    return this.cleanEnvValue(value)?.replace(/\\n/g, '\n');
  }
}
