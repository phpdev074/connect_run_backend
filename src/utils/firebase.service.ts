import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

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
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
        this.logger.log('Firebase Admin SDK initialized successfully');
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
      this.logger.error('Error sending push notification', error.stack);
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
      this.logger.error(`Error sending push notification to topic ${topic}`, error.stack);
      throw error;
    }
  }
}
