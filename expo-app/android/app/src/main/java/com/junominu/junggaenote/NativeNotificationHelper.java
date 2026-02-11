package com.junominu.junggaenote;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Native notification helper that reads cached client data from SharedPreferences
 * and displays notifications directly without needing JS engine.
 */
public class NativeNotificationHelper {

    private static final String TAG = "NativeNotificationHelper";
    private static final String PREFS_NAME = "ClientCachePrefs";
    private static final String CLIENTS_KEY = "cached_clients_json";
    private static final String CHANNEL_ID = "incoming-call-native";
    private static final int NOTIFICATION_ID = 3001;

    /**
     * Look up a phone number in the cached client data and show a notification if found.
     * Returns true if a matching client was found and notification was shown.
     */
    public static boolean showNotificationForNumber(Context context, String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isEmpty()) {
            Log.d(TAG, "No phone number provided");
            return false;
        }

        String cleanNumber = phoneNumber.replaceAll("[^0-9]", "");
        if (cleanNumber.isEmpty()) return false;

        // Format as dashed number for comparison
        String dashedNumber = cleanNumber;
        if (cleanNumber.length() == 11) {
            dashedNumber = cleanNumber.substring(0, 3) + "-" + cleanNumber.substring(3, 7) + "-" + cleanNumber.substring(7);
        } else if (cleanNumber.length() == 10) {
            dashedNumber = cleanNumber.substring(0, 3) + "-" + cleanNumber.substring(3, 6) + "-" + cleanNumber.substring(6);
        }

        Log.d(TAG, "Looking up: clean=" + cleanNumber + ", dashed=" + dashedNumber);

        // Read from SharedPreferences
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String jsonStr = prefs.getString(CLIENTS_KEY, null);

        if (jsonStr == null || jsonStr.isEmpty()) {
            Log.d(TAG, "No cached clients in SharedPreferences");
            // Show basic notification with just the phone number
            showBasicNotification(context, phoneNumber);
            return false;
        }

        try {
            JSONArray clients = new JSONArray(jsonStr);
            Log.d(TAG, "Cached clients count: " + clients.length());

            for (int i = 0; i < clients.length(); i++) {
                JSONObject client = clients.getJSONObject(i);
                String clientPhone = client.optString("phone", "");
                String clientClean = clientPhone.replaceAll("[^0-9]", "");

                if (clientClean.equals(cleanNumber)) {
                    // Match found!
                    String name = client.optString("name", "알 수 없음");
                    String notes = client.optString("notes", "");
                    String callHistory = client.optString("call_history", "");

                    Log.d(TAG, "Client match: " + name);
                    showClientNotification(context, name, callHistory);
                    return true;
                }
            }

            Log.d(TAG, "No matching client found for: " + cleanNumber);
        } catch (Exception e) {
            Log.e(TAG, "Error parsing cached clients", e);
        }

        return false;
    }

    private static void showClientNotification(Context context, String name, String callHistory) {
        createNotificationChannel(context);

        // Build contentText (shown in heads-up and collapsed notification — single line)
        StringBuilder contentText = new StringBuilder();
        // Build InboxStyle lines (shown in expanded notification)
        java.util.List<String> inboxLines = new java.util.ArrayList<>();

        if (callHistory != null && !callHistory.trim().isEmpty()) {
            String[] lines = callHistory.split("\\r?\\n");
            java.util.List<String> nonEmptyLines = new java.util.ArrayList<>();
            for (String line : lines) {
                if (!line.trim().isEmpty()) {
                    nonEmptyLines.add(line.trim());
                }
            }

            if (!nonEmptyLines.isEmpty()) {
                // Heads-up single line: show first history entry
                contentText.append("🕒 ").append(nonEmptyLines.get(0));

                // InboxStyle lines
                inboxLines.add("🕒 최근 이력:");
                int count = Math.min(nonEmptyLines.size(), 3);
                for (int i = 0; i < count; i++) {
                    inboxLines.add("  " + nonEmptyLines.get(i));
                }
                if (nonEmptyLines.size() > 3) {
                    inboxLines.add("  ... 외 " + (nonEmptyLines.size() - 3) + "건");
                }
            } else {
                contentText.append("🕒 이력 없음");
                inboxLines.add("🕒 이력 없음");
            }
        } else {
            contentText.append("🕒 이력 없음");
            inboxLines.add("🕒 이력 없음");
        }

        // Create intent to launch the app
        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        PendingIntent pendingIntent = null;
        if (launchIntent != null) {
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            pendingIntent = PendingIntent.getActivity(context, 0, launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        }

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(context, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(context);
        }

        builder.setContentTitle("📞 " + name + " 고객님")
                .setContentText(contentText.toString())
                .setSmallIcon(android.R.drawable.ic_menu_call)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_CALL)
                .setVisibility(Notification.VISIBILITY_PUBLIC);

        if (pendingIntent != null) {
            builder.setContentIntent(pendingIntent);
        }

        // Use InboxStyle for expanded multi-line view
        Notification.InboxStyle inboxStyle = new Notification.InboxStyle();
        inboxStyle.setBigContentTitle("📞 " + name + " 고객님");
        for (String line : inboxLines) {
            inboxStyle.addLine(line);
        }
        builder.setStyle(inboxStyle);

        // High priority for heads-up display
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            builder.setPriority(Notification.PRIORITY_HIGH);
        }

        Notification notification = builder.build();
        notification.defaults |= Notification.DEFAULT_VIBRATE;

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, notification);
        }
    }

    /**
     * Show a basic notification with just the phone number (when no client data is cached).
     */
    private static void showBasicNotification(Context context, String phoneNumber) {
        createNotificationChannel(context);

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(context, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(context);
        }

        builder.setContentTitle("📞 수신 전화")
                .setContentText(phoneNumber)
                .setSmallIcon(android.R.drawable.ic_menu_call)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_CALL)
                .setVisibility(Notification.VISIBILITY_PUBLIC);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            builder.setPriority(Notification.PRIORITY_HIGH);
        }

        Notification notification = builder.build();
        notification.defaults |= Notification.DEFAULT_VIBRATE;

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, notification);
        }
    }

    /**
     * Cancel the incoming call notification.
     */
    public static void cancelNotification(Context context) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel(NOTIFICATION_ID);
        }
    }

    /**
     * Create the notification channel (required for Android O+).
     */
    private static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "수신 전화 알림",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("고객 전화 수신 시 알림을 표시합니다");
            channel.enableVibration(true);
            channel.enableLights(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    /**
     * Save client data to SharedPreferences so it can be read by CallReceiver.
     */
    public static void saveClientsToPrefs(Context context, String jsonArrayStr) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(CLIENTS_KEY, jsonArrayStr).apply();
        Log.d(TAG, "Saved clients to SharedPreferences, length: " + (jsonArrayStr != null ? jsonArrayStr.length() : 0));
    }
}
