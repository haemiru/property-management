package com.junominu.junggaenote;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import android.util.Log;

/**
 * React Native native module that bridges JS client data to SharedPreferences.
 * This allows the CallReceiver (BroadcastReceiver) to read client data
 * in the background without needing the JS engine.
 */
public class NativeStorageBridge extends ReactContextBaseJavaModule {

    private static final String TAG = "NativeStorageBridge";

    public NativeStorageBridge(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "NativeStorageBridge";
    }

    /**
     * Called from JS to sync client data to SharedPreferences.
     * @param jsonArrayStr JSON array string of client objects
     */
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
