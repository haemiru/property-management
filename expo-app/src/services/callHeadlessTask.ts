import { AppRegistry } from 'react-native';
import notifee, { AndroidImportance, AndroidVisibility, AndroidCategory, AndroidStyle } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Headless JS task for background call detection
// This runs even when the app is in the background/killed

const SUPABASE_URL = 'https://fwlrmynlpbhusvzvlsmp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3bHJteW5scGJodXN2enZsc21wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxODAzMTgsImV4cCI6MjA4NTc1NjMxOH0.izHAtEXIpKi7LasNvZJ69NLlBWUQ1lvae6XWF8rJDS4';

async function displayNotification(customerName: string, notes: string | null, callHistory: string | null) {
    try {
        await notifee.requestPermission();

        const channelId = await notifee.createChannel({
            id: 'incoming-call-high-priority',
            name: 'Incoming Call (High Priority)',
            lights: true,
            vibration: true,
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            sound: 'default',
        });

        const inboxLines: string[] = [];
        if (callHistory && callHistory.trim()) {
            const historyLines = callHistory.split(/\r?\n/).filter((line: string) => line.trim());
            const recentLines = historyLines.slice(0, 3);
            inboxLines.push('🕒 최근 이력:');
            recentLines.forEach((line: string) => inboxLines.push(`  ${line}`));
            if (historyLines.length > 3) {
                inboxLines.push(`  ... 외 ${historyLines.length - 3}건`);
            }
        } else {
            inboxLines.push('🕒 이력 없음');
        }


        const firstHistoryLine = callHistory && callHistory.trim()
            ? callHistory.split(/\r?\n/).filter((l: string) => l.trim())[0]
            : null;
        const bodyText = firstHistoryLine
            ? `🕒 ${firstHistoryLine}`
            : '이력 없음';

        await notifee.displayNotification({
            id: 'incoming-call-notification',
            title: `📞 ${customerName} 고객님`,
            body: bodyText,
            android: {
                channelId,
                importance: AndroidImportance.HIGH,
                visibility: AndroidVisibility.PUBLIC,
                category: AndroidCategory.CALL,
                ongoing: false,
                autoCancel: true,
                pressAction: {
                    id: 'default',
                    launchActivity: 'default',
                },
                style: {
                    type: AndroidStyle.INBOX,
                    lines: inboxLines,
                },
                actions: [
                    {
                        title: '앱 열기',
                        pressAction: { id: 'open_app', launchActivity: 'default' },
                    },
                ],
                fullScreenAction: {
                    id: 'default',
                    launchActivity: 'default',
                },
            },
        });
    } catch (error) {
        console.error('[BackgroundCallDetection] Notification Error:', error);
    }
}

async function cancelNotification() {
    try {
        await notifee.cancelAllNotifications();
    } catch (e) {
        console.error('[BackgroundCallDetection] Cancel notification error:', e);
    }
}

async function backgroundCallDetectionTask(taskData: { event: string; phoneNumber: string }) {
    const { event, phoneNumber } = taskData;
    console.log('[BackgroundCallDetection] Event:', event, 'Number:', phoneNumber);

    if (event === 'Incoming') {
        if (!phoneNumber) {
            console.log('[BackgroundCallDetection] No phone number, skipping');
            return;
        }

        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        let dashedNumber = cleanNumber;
        if (cleanNumber.length === 11) {
            dashedNumber = `${cleanNumber.slice(0, 3)}-${cleanNumber.slice(3, 7)}-${cleanNumber.slice(7)}`;
        } else if (cleanNumber.length === 10) {
            dashedNumber = `${cleanNumber.slice(0, 3)}-${cleanNumber.slice(3, 6)}-${cleanNumber.slice(6)}`;
        }

        // 1. Try local cache first
        try {
            const cacheStr = await AsyncStorage.getItem('realtor_clients_cache');
            if (cacheStr) {
                const cachedClients = JSON.parse(cacheStr);
                const localMatch = cachedClients.find((c: any) => {
                    const cClean = c.phone.replace(/[^0-9]/g, '');
                    return cClean === cleanNumber;
                });

                if (localMatch) {
                    console.log('[BackgroundCallDetection] Cache hit:', localMatch.name);
                    await displayNotification(localMatch.name, localMatch.notes, localMatch.call_history || null);
                    return;
                }
            }
        } catch (cacheError) {
            console.error('[BackgroundCallDetection] Cache error:', cacheError);
        }

        // 2. Fallback to Supabase
        try {
            // Get session from AsyncStorage (supabase stores it there)
            const sessionStr = await AsyncStorage.getItem('supabase.auth.token');
            let accessToken: string | null = null;

            // Try different storage keys supabase might use
            const keys = await AsyncStorage.getAllKeys();
            const supabaseKey = keys.find(k => k.includes('supabase') && k.includes('auth'));
            if (supabaseKey) {
                const val = await AsyncStorage.getItem(supabaseKey);
                if (val) {
                    try {
                        const parsed = JSON.parse(val);
                        accessToken = parsed?.currentSession?.access_token || parsed?.access_token || null;
                    } catch { }
                }
            }

            const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    storage: AsyncStorage,
                    autoRefreshToken: false,
                    persistSession: false,
                    detectSessionInUrl: false,
                },
            });

            // Try to restore session
            if (accessToken) {
                // Use existing supabase client with stored session
            }

            const { data } = await supabase
                .from('clients')
                .select('*')
                .or(`phone.eq.${dashedNumber},phone.eq.${cleanNumber},phone.eq.${phoneNumber}`)
                .maybeSingle();

            if (data) {
                console.log('[BackgroundCallDetection] DB hit:', data.name);
                const history = data.call_history || data.callHistory || null;
                await displayNotification(data.name, data.notes || data.note || null, history);
            } else {
                console.log('[BackgroundCallDetection] No match found');
            }
        } catch (dbError) {
            console.error('[BackgroundCallDetection] DB error:', dbError);
        }
    } else if (event === 'Disconnected' || event === 'Missed' || event === 'Offhook') {
        await cancelNotification();
    }
}

// Register the headless task
AppRegistry.registerHeadlessTask('BackgroundCallDetection', () => backgroundCallDetectionTask);

// Register notifee background event handler (required for notification actions in background)
notifee.onBackgroundEvent(async ({ type, detail }) => {
    console.log('[BackgroundCallDetection] Background notification event:', type, detail);
});

console.log('[BackgroundCallDetection] Headless task registered');

