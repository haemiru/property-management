import { Tabs } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../src/constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { View, Text, TouchableOpacity, Alert } from 'react-native';

export default function TabLayout() {
    const insets = useSafeAreaInsets();
    const { signOut, user } = useAuth();

    const headerRight = () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, gap: 8 }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', maxWidth: 120 }} numberOfLines={1}>
                {user?.email || ''}
            </Text>
            <TouchableOpacity
                onPress={() => {
                    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
                        { text: '취소', style: 'cancel' },
                        { text: '로그아웃', style: 'destructive', onPress: signOut },
                    ]);
                }}
                style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.4)',
                }}
            >
                <Text style={{ fontSize: 11, color: '#ffffff', fontWeight: '600' }}>로그아웃</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.slate400,
                tabBarStyle: {
                    backgroundColor: Colors.white,
                    borderTopWidth: 1,
                    borderTopColor: Colors.slate200,
                    paddingTop: 5,
                    paddingBottom: insets.bottom + 5,
                    height: 60 + insets.bottom,
                },
                headerStyle: {
                    backgroundColor: Colors.primary,
                },
                headerTintColor: Colors.white,
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
                headerRight,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: '홈',
                    headerTitle: '중개노트',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="home" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="properties"
                options={{
                    title: '매물',
                    headerTitle: '매물 관리',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="apartment" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="clients"
                options={{
                    title: '고객',
                    headerTitle: '고객 관리',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="people" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="schedule"
                options={{
                    title: '일정',
                    headerTitle: '일정 관리',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="calendar" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: '설정',
                    headerTitle: '설정',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="settings-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
