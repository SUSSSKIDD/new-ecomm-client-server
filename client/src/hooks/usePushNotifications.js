import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export const usePushNotifications = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const registerPush = async () => {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('Push notification permission denied');
        return;
      }

      await PushNotifications.register();
    };

    const addListeners = async () => {
      await PushNotifications.addListener('registration', token => {
        console.info('Push registration success, token: ' + token.value);
        // Here you would typically send the token to your backend
        // e.g. api(userToken).post('/push-token', { token: token.value });
      });

      await PushNotifications.addListener('registrationError', err => {
        console.error('Push registration error: ', err.error);
      });

      await PushNotifications.addListener('pushNotificationReceived', notification => {
        console.info('Push notification received: ', notification);
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', action => {
        console.info('Push notification action performed', action.notification);
        // Handle notification click, e.g. navigate to order page
      });
    };

    registerPush();
    addListeners();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);
};
