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

public class NativeNotificationHelper {

    private static final String TAG = "NativeNotificationHelper";
    private static final String PREFS_NAME = "ClientCachePrefs";
    private static final String CLIENTS_KEY = "cached_clients_json";
    private static final String CHANNEL_ID = "incoming-call-native";
    private static final int NOTIFICATION_ID = 3001;

    public static boolean showNotificationForNumber(Context context, String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isEmpty()) {
            Log.d(TAG, "No phone number provided");
            return false;
        }

        // Normalize incoming number: remove non-digits, replace startsWith 82 with 0
        String cleanNumber = phoneNumber.replaceAll("[^0-9]", "");
        if (cleanNumber.startsWith("82")) {
            cleanNumber = "0" + cleanNumber.substring(2);
        }

        if (cleanNumber.isEmpty())
            return false;

        String dashedNumber = cleanNumber;
        if (cleanNumber.length() == 11) {
            dashedNumber = cleanNumber.substring(0, 3) + "-" + cleanNumber.substring(3, 7) + "-"
                    + cleanNumber.substring(7);
        } else if (cleanNumber.length() == 10) {
            dashedNumber = cleanNumber.substring(0, 3) + "-" + cleanNumber.substring(3, 6) + "-"
                    + cleanNumber.substring(6);
        }

        Log.d(TAG, "Looking up: clean=" + cleanNumber + ", dashed=" + dashedNumber);

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String jsonStr = prefs.getString(CLIENTS_KEY, null);

        if (jsonStr == null || jsonStr.isEmpty()) {
            Log.d(TAG, "No cached clients in SharedPreferences");
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

                // Also normalize stored client number just in case
                if (clientClean.startsWith("82")) {
                    clientClean = "0" + clientClean.substring(2);
                }

                // Check for exact match or suffix match (last 8 digits) to be safe
                boolean isMatch = false;
                if (clientClean.equals(cleanNumber)) {
                    isMatch = true;
                } else if (cleanNumber.length() >= 8 && clientClean.length() >= 8) {
                    // Fallback: compare last 8 digits (e.g. 1012345678)
                    String last8In = cleanNumber.substring(cleanNumber.length() - 8);
                    String last8Client = clientClean.substring(clientClean.length() - 8);
                    if (last8In.equals(last8Client)) {
                        isMatch = true;
                    }
                }

                if (isMatch) {
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

        StringBuilder contentText = new StringBuilder();
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
                contentText.append("🕒 ").append(nonEmptyLines.get(0));

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

        Notification.InboxStyle inboxStyle = new Notification.InboxStyle();
        inboxStyle.setBigContentTitle("📞 " + name + " 고객님");
        for (String line : inboxLines) {
            inboxStyle.addLine(line);
        }
        builder.setStyle(inboxStyle);

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

    public static void cancelNotification(Context context) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel(NOTIFICATION_ID);
        }
    }

    private static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "수신 전화 알림",
                    NotificationManager.IMPORTANCE_HIGH);
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

    public static void saveClientsToPrefs(Context context, String jsonArrayStr) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(CLIENTS_KEY, jsonArrayStr).apply();
        Log.d(TAG, "Saved clients to SharedPreferences, length: " + (jsonArrayStr != null ? jsonArrayStr.length() : 0));
    }
}
