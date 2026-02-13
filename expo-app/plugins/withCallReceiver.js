const {
    withAndroidManifest,
    withMainApplication,
    withDangerousMod,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// ──────────────────────────────────────────────────
//  1. Java source files to inject
// ──────────────────────────────────────────────────

const CALL_RECEIVER_JAVA = `package com.junominu.junggaenote;

import android.app.ActivityManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.telephony.TelephonyManager;
import android.util.Log;

import java.util.List;

public class CallReceiver extends BroadcastReceiver {
    private static final String TAG = "CallReceiver";
    private static boolean wasRinging = false;
    private static boolean wasOffhook = false;
    private static String lastPhoneNumber = null;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        if (!intent.getAction().equals(TelephonyManager.ACTION_PHONE_STATE_CHANGED)) return;

        String stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE);
        String phoneNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER);

        if (stateStr == null) return;

        if (phoneNumber != null && !phoneNumber.isEmpty()) {
            lastPhoneNumber = phoneNumber;
        }

        Log.d(TAG, "State: " + stateStr + ", Number: " + phoneNumber +
                ", LastNumber: " + lastPhoneNumber);

        if (TelephonyManager.EXTRA_STATE_RINGING.equals(stateStr)) {
            wasRinging = true;

            // Foreground check removed (JS listener is gone)
            // Always show native notification if number is known
            // if (isAppInForeground(context)) { ... }

            if (lastPhoneNumber != null && !lastPhoneNumber.isEmpty()) {
                Log.d(TAG, "Incoming call from: " + lastPhoneNumber + " → showing native notification");
                NativeNotificationHelper.showNotificationForNumber(context, lastPhoneNumber);
            } else {
                Log.d(TAG, "Incoming call but no number yet, waiting...");
            }

        } else if (TelephonyManager.EXTRA_STATE_OFFHOOK.equals(stateStr)) {
            wasOffhook = true;
            Log.d(TAG, "Call answered → cancelling notification");
            NativeNotificationHelper.cancelNotification(context);

        } else if (TelephonyManager.EXTRA_STATE_IDLE.equals(stateStr)) {
            if (wasRinging || wasOffhook) {
                Log.d(TAG, "Call ended → cancelling notification");
                NativeNotificationHelper.cancelNotification(context);
            }
            wasRinging = false;
            wasOffhook = false;
            lastPhoneNumber = null;
        }
    }

    // isAppInForeground method removed as it is no longer used
}
`;

const NATIVE_NOTIFICATION_HELPER_JAVA = `package com.junominu.junggaenote;

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

        String cleanNumber = phoneNumber.replaceAll("[^0-9]", "");
        if (cleanNumber.isEmpty()) return false;

        String dashedNumber = cleanNumber;
        if (cleanNumber.length() == 11) {
            dashedNumber = cleanNumber.substring(0, 3) + "-" + cleanNumber.substring(3, 7) + "-" + cleanNumber.substring(7);
        } else if (cleanNumber.length() == 10) {
            dashedNumber = cleanNumber.substring(0, 3) + "-" + cleanNumber.substring(3, 6) + "-" + cleanNumber.substring(6);
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

                if (clientClean.equals(cleanNumber)) {
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
            String[] lines = callHistory.split("\\\\r?\\\\n");
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

    public static void saveClientsToPrefs(Context context, String jsonArrayStr) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(CLIENTS_KEY, jsonArrayStr).apply();
        Log.d(TAG, "Saved clients to SharedPreferences, length: " + (jsonArrayStr != null ? jsonArrayStr.length() : 0));
    }
}
`;

const NATIVE_STORAGE_BRIDGE_JAVA = `package com.junominu.junggaenote;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import android.util.Log;

public class NativeStorageBridge extends ReactContextBaseJavaModule {

    private static final String TAG = "NativeStorageBridge";

    public NativeStorageBridge(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "NativeStorageBridge";
    }

    @ReactMethod
    public void syncClients(String jsonArrayStr) {
        try {
            NativeNotificationHelper.saveClientsToPrefs(
                    getReactApplicationContext(),
                    jsonArrayStr
            );
            Log.d(TAG, "Clients synced to SharedPreferences successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to sync clients", e);
        }
    }
}
`;

const NATIVE_STORAGE_PACKAGE_JAVA = `package com.junominu.junggaenote;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class NativeStoragePackage implements ReactPackage {

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new NativeStorageBridge(reactContext));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
`;

// ──────────────────────────────────────────────────
//  2. Modify AndroidManifest.xml
// ──────────────────────────────────────────────────
function withCallReceiverManifest(config) {
    return withAndroidManifest(config, (config) => {
        const manifest = config.modResults;
        const app = manifest.manifest.application[0];

        // Add permissions
        const permissions = manifest.manifest["uses-permission"] || [];
        const neededPermissions = [
            "android.permission.READ_PHONE_STATE",
            "android.permission.READ_CALL_LOG",
            "android.permission.WAKE_LOCK",
            "android.permission.POST_NOTIFICATIONS",
            "android.permission.USE_FULL_SCREEN_INTENT",
            "android.permission.VIBRATE",
        ];

        for (const perm of neededPermissions) {
            const exists = permissions.some(
                (p) => p.$?.["android:name"] === perm
            );
            if (!exists) {
                permissions.push({
                    $: { "android:name": perm },
                });
            }
        }
        manifest.manifest["uses-permission"] = permissions;

        // Add CallReceiver
        const receivers = app.receiver || [];
        const hasReceiver = receivers.some(
            (r) => r.$?.["android:name"] === ".CallReceiver"
        );
        if (!hasReceiver) {
            receivers.push({
                $: {
                    "android:name": ".CallReceiver",
                    "android:enabled": "true",
                    "android:exported": "true",
                },
                "intent-filter": [
                    {
                        action: [
                            { $: { "android:name": "android.intent.action.PHONE_STATE" } },
                        ],
                    },
                ],
            });
        }
        app.receiver = receivers;

        return config;
    });
}

// ──────────────────────────────────────────────────
//  3. Modify MainApplication.kt to add NativeStoragePackage
// ──────────────────────────────────────────────────
function withNativeStoragePackage(config) {
    return withDangerousMod(config, [
        "android",
        async (config) => {
            const mainAppPath = path.join(
                config.modRequest.platformProjectRoot,
                "app",
                "src",
                "main",
                "java",
                "com",
                "junominu",
                "junggaenote",
                "MainApplication.kt"
            );

            if (fs.existsSync(mainAppPath)) {
                let content = fs.readFileSync(mainAppPath, "utf8");

                // Add NativeStoragePackage() to the packages list if not already present
                if (!content.includes("NativeStoragePackage")) {
                    content = content.replace(
                        /PackageList\(this\)\.packages\.apply \{/,
                        `PackageList(this).packages.apply {\n              add(NativeStoragePackage())`
                    );
                }

                fs.writeFileSync(mainAppPath, content);
            }

            return config;
        },
    ]);
}

// ──────────────────────────────────────────────────
//  4. Write Java source files
// ──────────────────────────────────────────────────
function withJavaFiles(config) {
    return withDangerousMod(config, [
        "android",
        async (config) => {
            const javaDir = path.join(
                config.modRequest.platformProjectRoot,
                "app",
                "src",
                "main",
                "java",
                "com",
                "junominu",
                "junggaenote"
            );

            // Ensure directory exists
            fs.mkdirSync(javaDir, { recursive: true });

            const files = {
                "CallReceiver.java": CALL_RECEIVER_JAVA,
                "NativeNotificationHelper.java": NATIVE_NOTIFICATION_HELPER_JAVA,
                "NativeStorageBridge.java": NATIVE_STORAGE_BRIDGE_JAVA,
                "NativeStoragePackage.java": NATIVE_STORAGE_PACKAGE_JAVA,
            };

            for (const [fileName, content] of Object.entries(files)) {
                const filePath = path.join(javaDir, fileName);
                fs.writeFileSync(filePath, content);
                console.log(`[withCallReceiver] Wrote ${filePath}`);
            }

            return config;
        },
    ]);
}

// ──────────────────────────────────────────────────
//  Main plugin export
// ──────────────────────────────────────────────────
function withCallReceiver(config) {
    config = withCallReceiverManifest(config);
    config = withJavaFiles(config);
    config = withNativeStoragePackage(config);
    return config;
}

module.exports = withCallReceiver;
