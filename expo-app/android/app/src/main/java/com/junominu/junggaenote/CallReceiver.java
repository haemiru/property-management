package com.junominu.junggaenote;

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
                ", LastNumber: " + lastPhoneNumber + ", Foreground: " + isAppInForeground(context));

        if (TelephonyManager.EXTRA_STATE_RINGING.equals(stateStr)) {
            wasRinging = true;

            if (isAppInForeground(context)) {
                Log.d(TAG, "App is in foreground, skipping native notification (JS will handle)");
                return;
            }

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

    private boolean isAppInForeground(Context context) {
        try {
            ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
            if (am == null) return false;

            List<ActivityManager.RunningAppProcessInfo> processes = am.getRunningAppProcesses();
            if (processes == null) return false;

            String packageName = context.getPackageName();
            for (ActivityManager.RunningAppProcessInfo process : processes) {
                if (process.processName.equals(packageName) &&
                        process.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND) {
                    return true;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking foreground state", e);
        }
        return false;
    }
}
