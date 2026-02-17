import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { useEffect } from 'react';
import { View, ActivityIndicator, Platform, PermissionsAndroid, Alert } from 'react-native';
import { Colors } from '../src/constants';
// Removed unused imports: startCallListener, stopCallListener

function RootLayoutNav() {
    const { session, loading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        const inAuthGroup = segments[0] === 'auth';

        if (!session && !inAuthGroup) {
            router.replace('/auth/login');
        } else if (session && inAuthGroup) {
            router.replace('/(tabs)');
        }
    }, [session, loading, segments]);

    // Request permissions on mount
    useEffect(() => {
        const requestPermissions = async () => {
            if (Platform.OS !== 'android') return;

            try {
                const permissionsToRequest = [
                    PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
                    PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
                ].filter(Boolean); // Filter out undefined if any

                const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);

                const allGranted = Object.values(granted).every(
                    (status) => status === PermissionsAndroid.RESULTS.GRANTED
                );

                if (!allGranted) {
                    console.log('Some permissions denied:', granted);
                    // Optional: Show alert if critical permissions are denied
                    // Alert.alert('권한 필요', '전화 수신 알림을 위해 전화/통화기록 권한이 필요합니다.');
                } else {
                    console.log('All permissions granted');
                }
            } catch (err) {
                console.warn(err);
            }
        };

        requestPermissions();
    }, []);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth/login" />
        </Stack>
    );
}

export default function RootLayout() {
    return (
        <AuthProvider>
            <StatusBar style="dark" />
            <RootLayoutNav />
        </AuthProvider>
    );
}


