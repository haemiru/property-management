package com.junominu.junggaenote;

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
