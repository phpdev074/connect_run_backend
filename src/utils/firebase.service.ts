import * as admin from 'firebase-admin';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FirebaseService {
  constructor() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        // Optionally add databaseURL or other config here
      });
    }
  }

  async sendPushNotification(token: string, payload: admin.messaging.Message) {
    try {
      const response = await admin.messaging().send({ ...payload, token });
      return response;
    } catch (error) {
      console.error('Error sending push notification:', error);
      throw error;
    }
  }
}
