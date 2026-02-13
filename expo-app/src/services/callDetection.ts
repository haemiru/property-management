// import CallDetectorManager from 'react-native-call-detection'; // REMOVED
import { storage } from '../storageService';
import { supabase } from '../lib/supabase';
import { displayIncomingCallNotification, cancelNotification, displayPostCallNotification } from './notificationService';
import { Platform, PermissionsAndroid, ToastAndroid } from 'react-native';


// ... imports

// ... imports

// ... imports

// Variables for tracking call state (kept if needed for future logic, though mostly unused now)
let currentCallerId: string | null = null;
let currentCallerName: string | null = null;
// let callDetector: any = null; // REMOVED
let isCallActive = false;
let processingIncomingCall = false;
let isListenerSettingUp = false;

// Allow external modules to force a cache refresh (e.g., after editing a client)
// Compatibility wrapper - now we read directly from storage, log for debugging
export const reloadCache = async () => {
    console.log('Cache reload signal received (auto-handled via direct storage access)');
};

// Legacy startCallListener implementation removed.

// Library removed due to crash on Android 14+ (RN 0.81 incompatibility)
// All call detection is now handled by native CallReceiver.java
export const startCallListener = async () => {
    console.log('Use native CallReceiver for call detection.');
};

export const stopCallListener = () => {
    console.log('No-op: Native listener is persistent.');
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
