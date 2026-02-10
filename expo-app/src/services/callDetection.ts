import CallDetectorManager from 'react-native-call-detection';
import { storage } from '../storageService';
import { supabase } from '../lib/supabase';
import { displayIncomingCallNotification, cancelNotification, displayPostCallNotification } from './notificationService';
import { Platform, PermissionsAndroid, ToastAndroid } from 'react-native';


// ... imports

// ... imports

// ... imports

let currentCallerId: string | null = null;
let currentCallerName: string | null = null;
let callDetector: any = null;
let isCallActive = false; // Track call state to prevent late notifications
let processingIncomingCall = false; // Debounce flag
// memoryCache removed to prevent stale data
let isListenerSettingUp = false; // Prevent race conditions

// Allow external modules to force a cache refresh (e.g., after editing a client)
// Compatibility wrapper - now we read directly from storage, log for debugging
export const reloadCache = async () => {
    console.log('Cache reload signal received (auto-handled via direct storage access)');
};

export const startCallListener = async () => {

    if (Platform.OS !== 'android') return;

    if (callDetector) {
        console.log('Call listener already active, skipping setup.');
        return;
    }

    if (isListenerSettingUp) return;
    isListenerSettingUp = true;

    // Cache preloading removed - we read from storage on demand
    console.log('Call listener starting (direct storage mode)...');

    // Improved permission check
    try {
        const permissions = [
            // ...
            PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
            PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        ];
        const granted = await PermissionsAndroid.requestMultiple(permissions);

        if (granted['android.permission.READ_PHONE_STATE'] !== PermissionsAndroid.RESULTS.GRANTED ||
            granted['android.permission.READ_CALL_LOG'] !== PermissionsAndroid.RESULTS.GRANTED ||
            (Platform.Version >= 33 && granted['android.permission.POST_NOTIFICATIONS'] !== PermissionsAndroid.RESULTS.GRANTED)) {
            console.log('Call detection permissions denied');
            return;
        }
    } catch (err) {
        console.warn(err);
        return;
    }

    // Disposal logic removed - we now check if callDetector exists at the top to enforce Singleton.
    // if (callDetector) { callDetector.dispose(); }

    callDetector = new CallDetectorManager(
        async (event: string, phoneNumber: string) => {
            console.log('Call Event:', event, 'Number:', phoneNumber);

            if (event && (event === 'Incoming' || event === 'RxNotification')) {
                isCallActive = true;
                if (phoneNumber && !processingIncomingCall) { // Debounce
                    processingIncomingCall = true;
                    try {
                        await handleIncomingCall(phoneNumber);
                    } catch (e) {
                        console.error(e);
                    } finally {
                        processingIncomingCall = false;
                    }
                } else if (!phoneNumber) {
                    console.log('No phone number detected');
                }
            } else if (event === 'Disconnected' || event === 'Missed' || event === 'IncomingEnded' || event === 'Rejected') {
                console.log(`Call Ended (Event: ${event})`);
                isCallActive = false;
                await cancelNotification(); // Cancel incoming call notification

                // Commented out to prevent "Zombie Notification" complaint if this is it
                // if (currentCallerId && currentCallerName) {
                //    await displayPostCallNotification(currentCallerId, currentCallerName);
                // }

                // Reset
                currentCallerId = null;
                currentCallerName = null;
            } else if (event === 'Offhook') {
                isCallActive = true;
                cancelNotification(); // Call answered, cancel notification
            }
        },
        true, // readPhoneNumber
        () => { console.log('Permission denied via library callback'); },
        {
            title: 'Phone State Permission',
            message: 'This app needs access to your phone state to display customer info on incoming calls',
        }
    );
    isListenerSettingUp = false;
};

export const stopCallListener = () => {
    console.log('Stopping call listener...');

    if (callDetector) {
        callDetector.dispose();
        callDetector = null;
    }
};

async function handleIncomingCall(phoneNumber: string) {
    try {
        if (!phoneNumber) return;

        // Normalize: remove dashes, spaces, etc.
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');

        // Format as 010-XXXX-YYYY for compatibility with DB stored with dashes
        let dashedNumber = cleanNumber;
        if (cleanNumber.length === 11) {
            dashedNumber = `${cleanNumber.slice(0, 3)}-${cleanNumber.slice(3, 7)}-${cleanNumber.slice(7)}`;
        } else if (cleanNumber.length === 10) {
            dashedNumber = `${cleanNumber.slice(0, 3)}-${cleanNumber.slice(3, 6)}-${cleanNumber.slice(6)}`;
        }

        // REMOVED: Initial "Searching..." notification (User request: silent for unknown numbers)

        // 1. Try Local Cache FIRST
        console.log(`[CallDetection] Searching local cache for ${dashedNumber} or ${cleanNumber}...`);
        try {
            const cachedClients = await storage.getCachedClients();
            console.log(`[CallDetection] Cache size: ${cachedClients.length}`);

            const localMatch = cachedClients.find(c => {
                const cClean = c.phone.replace(/[^0-9]/g, '');
                return cClean === cleanNumber;
            });

            if (localMatch) {
                console.log('[CallDetection] Local Cache Hit:', localMatch.name);

                if (!isCallActive) {
                    console.log('Call ended (local cache hit). Skipping notification.');
                    return;
                }

                await displayIncomingCallNotification(localMatch.name, localMatch.notes, localMatch.call_history || null);

                // Double check for zombie
                if (!isCallActive) {
                    await cancelNotification();
                }
                return; // Found locally, stop here!
            }
        } catch (cacheError) {
            console.error('[CallDetection] Local cache search failed:', cacheError);
        }

        // 2. Fallback to Supabase (Network)
        console.log(`[Supabase] Starting query for ${dashedNumber} or ${cleanNumber}...`);

        // Debug Auth State
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[Supabase] Auth Session:', session ? `Logged in as ${session.user.email}` : 'NO SESSION (RLS may block query)');

        const queryPromise = supabase
            .from('clients')
            .select('*')
            .or(`phone.eq.${dashedNumber},phone.eq.${cleanNumber},phone.eq.${phoneNumber}`)
            .maybeSingle();

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Query Timeout')), 10000)
        );

        let data = null;
        try {
            const result: any = await Promise.race([queryPromise, timeoutPromise]);
            data = result.data;
        } catch (e) {
            console.error('Data fetch failed or timed out:', e);
            // REMOVED: Error notification
        }

        if (!isCallActive) return;

        if (data) {
            console.log('DB Hit:', data.name);
            const c = data as any;
            const history = c.call_history || c.callHistory || null;

            if (!isCallActive) return;

            await displayIncomingCallNotification(c.name, c.notes || c.note || null, history);

            // Double check for zombie
            if (!isCallActive) {
                await cancelNotification();
            }

            // 3. Self-Healing Cache
            try {
                if (c.id && c.name && c.phone) {
                    const clientToCache: any = {
                        id: c.id,
                        name: c.name,
                        phone: c.phone,
                        role: c.role || '임대인',
                        notes: c.notes || '',
                        call_history: history || '',
                        updated_at: c.updated_at || ''
                    };
                    const currentCache = await storage.getCachedClients();
                    const exists = currentCache.some(existing => existing.id === c.id);
                    if (!exists) {
                        await storage.updateLocalCache([clientToCache, ...currentCache]);
                    } else {
                        const updatedCache = currentCache.map(existing =>
                            existing.id === c.id ? clientToCache : existing
                        );
                        await storage.updateLocalCache(updatedCache);
                    }
                }
            } catch (cacheErr) {
                console.error('[CallDetection] Failed to update cache:', cacheErr);
            }
        } else {
            console.log('No match found. Converting to silent (no notification).');
            // REMOVED: Unknown number notification
        }

    } catch (error) {
        console.error('Incoming Call Error:', error);
    }
}
