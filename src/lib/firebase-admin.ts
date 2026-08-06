import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from './supabase-admin';

// Safe lazy initializer for Firebase Admin SDK using firebase-admin v12+ modular imports
export function getFirebaseAdminApp(): App | null {
  try {
    const existingApps = getApps();
    if (existingApps.length > 0 && existingApps[0]) {
      return existingApps[0];
    }

    const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');

    if (fs.existsSync(serviceAccountPath)) {
      try {
        const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
        const serviceAccount = JSON.parse(fileContent);

        if (typeof serviceAccount.private_key === 'string') {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        return initializeApp({
          credential: cert(serviceAccount),
        });
      } catch (e: any) {
        console.error('[FirebaseAdmin] Error parsing/initializing firebase-service-account.json:', e?.message || e);
      }
    }

    // Support loading from a single environment variable containing the service account JSON
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (typeof serviceAccount.private_key === 'string') {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        return initializeApp({
          credential: cert(serviceAccount),
        });
      } catch (e: any) {
        console.error('[FirebaseAdmin] Error parsing FIREBASE_SERVICE_ACCOUNT env var:', e?.message || e);
      }
    }

    // Fallback to separate environment variables if JSON file is missing
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      return initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }

    console.warn('[FirebaseAdmin] firebase-service-account.json not found and env vars missing.');
    return null;
  } catch (err: any) {
    console.error('[FirebaseAdmin] Exception during initialization:', err?.message || err);
    return null;
  }
}

/**
 * Send FCM Push Notification (HTTP v1) to specific users by user_ids or all users.
 */
export async function sendFcmPushNotification({
  userIds,
  title,
  body,
  data = {},
}: {
  userIds?: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const app = getFirebaseAdminApp();
    if (!app) {
      return { success: false, count: 0, error: 'Firebase Admin belum terkonfigurasi (Gagal muat service account)' };
    }

    // 1. Fetch user FCM tokens from Supabase table
    let tokenQuery = supabaseAdmin.from('user_fcm_tokens').select('fcm_token, user_id');

    if (userIds !== undefined) {
      if (userIds.length === 0) {
        console.log('[FCM] Target userIds bernilai array kosong. Tidak ada penerima yang dituju.');
        return { success: true, count: 0 };
      }
      tokenQuery = tokenQuery.in('user_id', userIds);
    }

    const { data: tokenRecords, error: tokenError } = await tokenQuery;

    if (tokenError) {
      console.error('[FCM] Error querying tokens:', tokenError.message);
      return { success: false, count: 0, error: tokenError.message };
    }

    if (!tokenRecords || tokenRecords.length === 0) {
      console.log('[FCM] Belum ada token FCM yang terdaftar untuk penerima target.');
      return { success: true, count: 0 };
    }

    // Filter unique tokens
    const tokens = Array.from(new Set(tokenRecords.map((t) => t.fcm_token).filter(Boolean)));

    if (tokens.length === 0) {
      return { success: true, count: 0 };
    }

    // 2. Multicast push message using HTTP v1 (Supports Heads-up banner + custom sound)
    const messaging = getMessaging(app);
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
      },
      android: {
        priority: 'high',
        notification: {
          title,
          body,
          sound: 'announcement_sound',
          channelId: 'announcements_channel_v2',
          priority: 'max',
          visibility: 'public',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            sound: 'default',
            badge: 1,
          },
        },
      },
      data: {
        ...data,
        title,
        body,
      },
    });

    console.log(`[FCM] Sent push notification. Success: ${response.successCount}, Failure: ${response.failureCount}`);

    // Cleanup invalid tokens if any
    if (response.failureCount > 0) {
      const badTokens: string[] = [];
      response.responses.forEach((res, index) => {
        if (!res.success && (res.error?.code === 'messaging/invalid-registration-token' || res.error?.code === 'messaging/registration-token-not-registered')) {
          badTokens.push(tokens[index]);
        }
      });

      if (badTokens.length > 0) {
        await supabaseAdmin.from('user_fcm_tokens').delete().in('fcm_token', badTokens);
        console.log(`[FCM] Cleaned up ${badTokens.length} expired FCM tokens.`);
      }
    }

    return { success: true, count: response.successCount };
  } catch (err: any) {
    console.error('[FCM] Error sending push notification:', err);
    return { success: false, count: 0, error: err.message || 'Push failed' };
  }
}
