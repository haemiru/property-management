package com.junominu.junggaenote;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import com.facebook.react.HeadlessJsTaskService;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;

import javax.annotation.Nullable;

public class CallHeadlessTaskService extends HeadlessJsTaskService {

    private static final String TAG = "CallHeadlessTaskService";
    private static final String CHANNEL_ID = "call-detection-service";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // startForegroundService() requires calling startForeground() within 5 seconds
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "Call Detection Service",
                        NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("Background call detection service");
                NotificationManager manager = getSystemService(NotificationManager.class);
                if (manager != null) {
                    manager.createNotificationChannel(channel);
                }

                Notification notification = new Notification.Builder(this, CHANNEL_ID)
                        .setContentTitle("전화 감지 중")
                        .setSmallIcon(android.R.drawable.ic_menu_call)
                        .build();

                // Android 14+ (API 34) requires foregroundServiceType in startForeground()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    startForeground(1001, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL);
                } else {
                    startForeground(1001, notification);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to start foreground service", e);
            // Even if foreground fails, try to continue with the headless task
        }

        try {
            return super.onStartCommand(intent, flags, startId);
        } catch (Exception e) {
            Log.e(TAG, "HeadlessJsTaskService.onStartCommand failed", e);
            // If HeadlessJS engine is not available, show notification from native side
            if (intent != null && intent.getExtras() != null) {
                String event = intent.getExtras().getString("event", "");
                String phoneNumber = intent.getExtras().getString("phoneNumber", "");
                if ("Incoming".equals(event) && phoneNumber != null && !phoneNumber.isEmpty()) {
                    showFallbackNotification(phoneNumber);
                }
            }
            stopSelf(startId);
            return START_NOT_STICKY;
        }
    }

    /**
     * Fallback: show a basic notification from native side when HeadlessJS is not available
     */
    private void showFallbackNotification(String phoneNumber) {
        try {
            String channelId = "incoming-call-high-priority";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        channelId,
                        "Incoming Call (High Priority)",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Incoming call notifications");
                channel.enableVibration(true);
                channel.enableLights(true);
                NotificationManager manager = getSystemService(NotificationManager.class);
                if (manager != null) {
                    manager.createNotificationChannel(channel);
                }
            }

            Notification notification = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                notification = new Notification.Builder(this, channelId)
                        .setContentTitle("📞 수신 전화")
                        .setContentText(phoneNumber)
                        .setSmallIcon(android.R.drawable.ic_menu_call)
                        .setAutoCancel(true)
                        .setCategory(Notification.CATEGORY_CALL)
                        .setVisibility(Notification.VISIBILITY_PUBLIC)
                        .build();
            }

            if (notification != null) {
                NotificationManager manager = getSystemService(NotificationManager.class);
                if (manager != null) {
                    manager.notify(2001, notification);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to show fallback notification", e);
        }
    }

    @Override
    protected @Nullable HeadlessJsTaskConfig getTaskConfig(Intent intent) {
        Bundle extras = intent.getExtras();
        if (extras == null) return null;

        WritableMap data = Arguments.createMap();
        data.putString("event", extras.getString("event", ""));
        data.putString("phoneNumber", extras.getString("phoneNumber", ""));

        return new HeadlessJsTaskConfig(
                "BackgroundCallDetection",  // Must match JS task name
                data,
                30000, // timeout in ms (30 seconds)
                true   // allow task in foreground too
        );
    }
}
