import { Capacitor } from '@capacitor/core';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
import { FirebasePerformance } from '@capacitor-firebase/performance';

const isNative = Capacitor.isNativePlatform();

export async function logEvent(name, params = {}) {
  if (!isNative) return; // no-op on web
  await FirebaseAnalytics.logEvent({ name, params });
}

export async function setUserId(userId) {
  if (!isNative) return;
  await FirebaseAnalytics.setUserId({ userId });
  await FirebaseCrashlytics.setUserId({ userId });
}

export async function setUserProperty(key, value) {
  if (!isNative) return;
  await FirebaseAnalytics.setUserProperty({ key, value });
}

// Performance monitoring methods
export async function startTrace(traceName) {
  if (!isNative) return;
  await FirebasePerformance.startTrace({ traceName });
}

export async function stopTrace(traceName) {
  if (!isNative) return;
  await FirebasePerformance.stopTrace({ traceName });
}

// Crashlytics methods
export async function recordException(message) {
  if (!isNative) return;
  await FirebaseCrashlytics.recordException({ message });
}
