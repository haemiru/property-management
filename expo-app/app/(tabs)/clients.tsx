import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    Linking,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Client, ClientRole } from '../../src/types';
import { storage } from '../../src/storageService';
import { Icons, Colors } from '../../src/constants';
import { useFocusEffect } from 'expo-router';
import notifee, { EventType } from '@notifee/react-native';
import { reloadCache } from '../../src/services/callDetection';

export default function ClientsScreen() {
    const [clients, setClients] = useState<Client[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<ClientRole | '전체'>('전체');

    // Handle Notification Interaction
    useEffect(() => {
        const checkNotification = async () => {
            // Check if opened from a notification (dead state)
            const initialNotification = await notifee.getInitialNotification();
            if (initialNotification && initialNotification.notification.data?.clientId) {
                const clientId = initialNotification.notification.data.clientId as string;
                handleOpenEditId(clientId);
            }
        };

        checkNotification();

        // Listen for foreground events (active state)
        const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
            if (type === EventType.PRESS && detail.notification?.data?.clientId) {
                const clientId = detail.notification.data.clientId as string;
                handleOpenEditId(clientId);
            }
        });

        return unsubscribe;
    }, [clients]);

    const handleOpenEditId = (clientId: string) => {
        const client = clients.find(c => c.id === clientId);
        if (client) {
            handleOpenEdit(client);
        } else {
            console.log('Client not found in list for ID:', clientId);
        }
    };

    const [newClient, setNewClient] = useState<Partial<Client>>({
        role: ClientRole.LANDLORD,
    });
    const [editingClient, setEditingClient] = useState<Client | null>(null);

    const loadData = async () => {
        const data = await storage.getClients();
        setClients(data);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
            return () => {
                setIsAdding(false);
                setEditingClient(null);
                setNewClient({ role: ClientRole.LANDLORD });
            };
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleOpenAdd = () => {
        setEditingClient(null);
        setNewClient({ role: ClientRole.LANDLORD, call_history: '' });
        setIsAdding(true);
    };

    const handleOpenEdit = (client: Client) => {
        setEditingClient(client);
        setNewClient({
            name: client.name,
            phone: client.phone,
            role: client.role,
            notes: client.notes,
            call_history: client.call_history
        });
        setIsAdding(true);
    };

    const handleSubmit = async () => {
        if (!newClient.name || !newClient.phone) {
            Alert.alert('알림', '이름과 연락처를 입력해주세요.');
            return;
        }

        try {
            const clientData = {
                name: newClient.name!,
                phone: newClient.phone!,
                role: newClient.role as ClientRole,
                notes: newClient.notes || '',
                call_history: newClient.call_history || '',
            };

            if (editingClient) {
                await storage.updateClient({
                    ...editingClient,
                    ...clientData
                });

                const updatedClients = clients.map(c =>
                    c.id === editingClient.id ? { ...c, ...clientData } : c
                );
                setClients(updatedClients);
                // Explicitly update cache to be 100% sure
                await storage.updateLocalCache(updatedClients);
            } else {
                const savedClient = await storage.addClient(clientData);
                const newClients = [savedClient, ...clients];
                setClients(newClients);
                // Explicitly update cache to be 100% sure
                await storage.updateLocalCache(newClients);
            }

            // Sync cache with call listener (Log only now)
            await reloadCache();

            setNewClient({ role: ClientRole.LANDLORD });
            setEditingClient(null);
            setIsAdding(false);
        } catch (error) {
            console.error('Client save error:', error);
            Alert.alert('오류', '고객 저장 중 오류가 발생했습니다.');
        }
    };

    const handleDelete = async (id: string) => {
        Alert.alert('삭제 확인', '정말로 이 고객을 삭제하시겠습니까?', [
            { text: '취소', style: 'cancel' },
            {
                text: '삭제',
                style: 'destructive',
                onPress: async () => {
                    const newClients = clients.filter(c => c.id !== id);
                    setClients(newClients);
                    await storage.deleteClient(id);
                    await reloadCache();
                },
            },
        ]);
    };

    const handleCall = (phone: string) => {
        Linking.openURL(`tel:${phone}`);
    };

    const filteredClients = clients.filter(client => {
        const matchesSearch =
            client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.phone.includes(searchTerm);
        const matchesRole = filterRole === '전체' || client.role === filterRole;
        return matchesSearch && matchesRole;
    });

    const getRoleBadgeStyle = (role: ClientRole) => {
        switch (role) {
            case ClientRole.LANDLORD:
                return { bg: Colors.blueLight, text: Colors.blue };
            case ClientRole.TENANT:
                return { bg: Colors.orangeLight, text: Colors.orange };
            case ClientRole.SELLER:
                return { bg: Colors.purpleLight, text: Colors.purple };
            case ClientRole.BUYER:
                return { bg: Colors.emeraldLight, text: Colors.emerald };
            default:
                return { bg: Colors.slate100, text: Colors.slate600 };
        }
    };

    return (
        <View style={styles.container}>
            {/* Search */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputWrapper}>
                    <Icons.Search size={18} color={Colors.slate400} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="이름 또는 연락처 검색"
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        placeholderTextColor={Colors.slate400}
                    />
                </View>
            </View>

            {/* Filter Chips */}
            <View style={styles.filterContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity
                        style={[styles.filterChip, filterRole === '전체' && styles.filterChipActive]}
                        onPress={() => setFilterRole('전체')}
                    >
                        <Text style={[styles.filterChipText, filterRole === '전체' && styles.filterChipTextActive]}>
                            전체
                        </Text>
                    </TouchableOpacity>
                    {Object.values(ClientRole).map(role => (
                        <TouchableOpacity
                            key={role}
                            style={[styles.filterChip, filterRole === role && styles.filterChipActive]}
                            onPress={() => setFilterRole(role)}
                        >
                            <Text style={[styles.filterChipText, filterRole === role && styles.filterChipTextActive]}>
                                {role}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView
                style={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {filteredClients.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Icons.Users size={32} color={Colors.slate300} />
                        <Text style={styles.emptyText}>
                            {searchTerm || filterRole !== '전체' ? '검색 결과가 없습니다.' : '등록된 고객이 없습니다.'}
                        </Text>
                    </View>
                ) : (
                    filteredClients.map(client => {
                        const badgeStyle = getRoleBadgeStyle(client.role);
                        return (
                            <TouchableOpacity
                                key={client.id}
                                style={styles.clientCard}
                                onPress={() => handleOpenEdit(client)}
                            >
                                <View style={styles.clientIcon}>
                                    <Icons.Users size={20} color={Colors.emerald} />
                                </View>
                                <View style={styles.clientInfo}>
                                    <View style={styles.clientHeader}>
                                        <Text style={styles.clientName}>{client.name}</Text>
                                        <View style={[styles.roleBadge, { backgroundColor: badgeStyle.bg }]}>
                                            <Text style={[styles.roleBadgeText, { color: badgeStyle.text }]}>
                                                {client.role}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.clientPhone}>{client.phone}</Text>
                                    {client.notes && (
                                        <Text style={styles.clientNotes} numberOfLines={1}>
                                            "{client.notes}"
                                        </Text>
                                    )}
                                </View>
                                <View style={styles.clientActions}>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => handleCall(client.phone)}
                                    >
                                        <Icons.Phone size={18} color={Colors.emerald} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => handleDelete(client.id)}
                                    >
                                        <Icons.Trash size={18} color={Colors.slate300} />
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={handleOpenAdd}>
                <Icons.Plus size={24} color={Colors.white} />
            </TouchableOpacity>

            {/* Add Modal */}
            <Modal visible={isAdding} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingClient ? '고객 정보 수정' : '고객 추가'}</Text>
                            <TouchableOpacity onPress={() => setIsAdding(false)}>
                                <Text style={styles.modalClose}>닫기</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalContent}>
                            <Text style={styles.label}>성함</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="이름을 입력하세요"
                                value={newClient.name || ''}
                                onChangeText={text => setNewClient({ ...newClient, name: text })}
                                placeholderTextColor={Colors.slate400}
                            />

                            <Text style={styles.label}>연락처</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="010-0000-0000"
                                value={newClient.phone || ''}
                                onChangeText={text => setNewClient({ ...newClient, phone: text })}
                                keyboardType="phone-pad"
                                placeholderTextColor={Colors.slate400}
                            />

                            <Text style={styles.label}>구분</Text>
                            <View style={styles.roleSelector}>
                                {Object.values(ClientRole).map(role => (
                                    <TouchableOpacity
                                        key={role}
                                        style={[styles.roleOption, newClient.role === role && styles.roleOptionActive]}
                                        onPress={() => setNewClient({ ...newClient, role })}
                                    >
                                        <Text style={[styles.roleOptionText, newClient.role === role && styles.roleOptionTextActive]}>
                                            {role}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>메모</Text>
                            <TextInput
                                style={[styles.input, styles.textarea]}
                                placeholder="추가적인 정보를 입력하세요"
                                value={newClient.notes || ''}
                                onChangeText={text => setNewClient({ ...newClient, notes: text })}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                                placeholderTextColor={Colors.slate400}
                            />

                            <Text style={styles.label}>통화 이력 <Text style={{ fontSize: 11, fontWeight: 'normal', color: '#94a3b8' }}>(최신 이력을 위에 적으세요)</Text></Text>
                            <TextInput
                                style={[styles.input, styles.textarea]}
                                placeholder="통화 내용을 기록하세요"
                                value={newClient.call_history || ''}
                                onChangeText={text => setNewClient({ ...newClient, call_history: text })}
                                multiline
                                numberOfLines={5}
                                textAlignVertical="top"
                                placeholderTextColor={Colors.slate400}
                            />

                            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                                <Text style={styles.submitButtonText}>{editingClient ? '수정 완료' : '고객 등록하기'}</Text>
                            </TouchableOpacity>

                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>
                </SafeAreaView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.slate50 },
    searchContainer: { padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.slate200 },
    searchInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.slate50, borderRadius: 12, paddingHorizontal: 12, gap: 8 },
    searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: Colors.slate800 },
    filterContainer: { padding: 12, backgroundColor: Colors.white },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.slate200, marginRight: 8 },
    filterChipActive: { backgroundColor: Colors.emerald, borderColor: Colors.emerald },
    filterChipText: { fontSize: 12, fontWeight: '500', color: Colors.slate600 },
    filterChipTextActive: { color: Colors.white },
    list: { flex: 1, padding: 16 },
    fab: { position: 'absolute', bottom: 90, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.emerald, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    emptyContainer: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { marginTop: 8, color: Colors.slate400, fontSize: 14 },
    clientCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.white, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.slate100 },
    clientIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.slate50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.emeraldLight, marginRight: 12 },
    clientInfo: { flex: 1 },
    clientHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    clientName: { fontWeight: 'bold', color: Colors.slate800, fontSize: 15 },
    roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    roleBadgeText: { fontSize: 10, fontWeight: 'bold' },
    clientPhone: { fontSize: 12, color: Colors.slate500 },
    clientNotes: { fontSize: 11, color: Colors.slate400, fontStyle: 'italic', marginTop: 8 },
    clientActions: { gap: 12 },
    actionButton: { padding: 4 },
    // Modal
    modalContainer: { flex: 1, backgroundColor: Colors.white },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.slate800 },
    modalClose: { color: Colors.slate400, fontSize: 14 },
    modalContent: { padding: 16 },
    label: { fontSize: 12, fontWeight: '600', color: Colors.slate500, textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
    input: { borderWidth: 1, borderColor: Colors.slate200, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.slate800, backgroundColor: Colors.white },
    textarea: { height: 80 },
    roleSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    roleOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.slate200, backgroundColor: Colors.white },
    roleOptionActive: { backgroundColor: Colors.emerald, borderColor: Colors.emerald },
    roleOptionText: { fontSize: 14, color: Colors.slate600 },
    roleOptionTextActive: { color: Colors.white, fontWeight: '600' },
    submitButton: { backgroundColor: Colors.emerald, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
    submitButtonText: { color: Colors.white, fontWeight: 'bold', fontSize: 16 },
});
