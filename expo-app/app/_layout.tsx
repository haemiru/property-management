import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
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


