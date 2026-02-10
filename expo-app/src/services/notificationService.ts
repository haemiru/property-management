import notifee, { AndroidImportance, AndroidVisibility, AndroidCategory, AndroidStyle } from '@notifee/react-native';
import { Platform, ToastAndroid } from 'react-native';

export const displayIncomingCallNotification = async (customerName: string, notes: string | null, callHistory: string | null) => {
    try {
        console.log('Displaying notification for:', customerName);

        // Request permissions (required for iOS)
        await notifee.requestPermission();

        // Create a channel (required for Android)
        const channelId = await notifee.createChannel({
            id: 'incoming-call-high-priority',
            name: 'Incoming Call (High Priority)',
            lights: true,
            vibration: true,
            importance: AndroidImportance.HIGH, // Must be HIGH for heads-up
            visibility: AndroidVisibility.PUBLIC,
            sound: 'default',
        });

        // Content: Build individual lines for InboxStyle (limit to 3 most recent history lines)
        console.log('[NotificationService] Raw callHistory:', JSON.stringify(callHistory));
        const inboxLines: string[] = [];

        if (callHistory && callHistory.trim()) {
            const historyLines = callHistory.split(/\r?\n/).filter((line: string) => line.trim());
            // Show only the first 3 lines (most recent, since newest is at top)
            const recentLines = historyLines.slice(0, 3);
            console.log('[NotificationService] Recent 3 lines:', JSON.stringify(recentLines));
            inboxLines.push('🕒 최근 이력:');
            recentLines.forEach((line: string) => inboxLines.push(`  ${line}`));
            if (historyLines.length > 3) {
                inboxLines.push(`  ... 외 ${historyLines.length - 3}건`);
            }
        } else {
            inboxLines.push('🕒 이력 없음');
        }

        if (notes) {
            inboxLines.push(`📝 메모: ${notes}`);
        }

        // Body text for collapsed view - show recent history summary
        const bodyText = callHistory && callHistory.trim()
            ? `🕒 이력 ${callHistory.split(/\r?\n/).filter((l: string) => l.trim()).length}건 | ${notes ? '📝 ' + notes : ''}`
            : notes ? `📝 메모: ${notes}` : '정보 없음';

        console.log(`[NotificationService] Updating notification for ${customerName} (ID: incoming-call-notification)`);
        console.log('[NotificationService] InboxStyle lines:', JSON.stringify(inboxLines));

        // Display a notification with a FIXED ID to allow updates
        await notifee.displayNotification({
            id: 'incoming-call-notification', // FIXED ID
            title: `📞 ${customerName} 고객님`,
            body: bodyText,
            android: {
                channelId,
                importance: AndroidImportance.HIGH, // Must be HIGH
                visibility: AndroidVisibility.PUBLIC,
                category: AndroidCategory.CALL,
                ongoing: false, // Allow swipe dismissal
                autoCancel: true,
                pressAction: {
                    id: 'default',
                    launchActivity: 'default',
                },
                style: {
                    type: AndroidStyle.INBOX,
                    lines: inboxLines,
                },
                // Actions to add interactivity (optional)
                actions: [
                    {
                        title: '앱 열기',
                        pressAction: { id: 'open_app', launchActivity: 'default' },
                    },
                ],
                // Use fullScreenIntent to show over lock screen if possible (requires permission)
                fullScreenAction: {
                    id: 'default',
                    launchActivity: 'default',
                },
            },
        });
        console.log('[NotificationService] Notification displayed/updated successfully');

    } catch (error) {
        console.error('Notification Error:', error);
    }
};

export const displayPostCallNotification = async (clientId: string, customerName: string) => {
    const channelId = await notifee.createChannel({
        id: 'post-call-high-priority',
        name: 'Post Call (High Priority)',
        importance: AndroidImportance.HIGH,
    });

    await notifee.displayNotification({
        title: '통화는 어떠셨나요?',
        body: `${customerName} 고객님과의 통화 내용을 기록해보세요.`,
        data: { clientId, action: 'post_call_note' },
        android: {
            channelId,
            importance: AndroidImportance.HIGH,
            pressAction: {
                id: 'post_call',
                launchActivity: 'default',
            },
            actions: [
                {
                    title: '기록하기',
                    pressAction: { id: 'add_note', launchActivity: 'default' },
                },
            ],
        },
    });
};

export const cancelNotification = async () => {
    await notifee.cancelAllNotifications();
}
