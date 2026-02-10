import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, Image } from 'react-native';
import { Property, Client, ScheduleTask } from '../../src/types';
import { storage } from '../../src/storageService';
import { Icons, Colors } from '../../src/constants';

import { useFocusEffect, router } from 'expo-router';

export default function HomeScreen() {
    const [properties, setProperties] = useState<Property[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [tasks, setTasks] = useState<ScheduleTask[]>([]);

    // Settings
    const [showSettings, setShowSettings] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async () => {
        const [props, clnts, tsks] = await Promise.all([
            storage.getProperties(),
            storage.getClients(),
            storage.getTasks(),
        ]);
        setProperties(props);
        setClients(clnts);
        setTasks(tsks);
    };

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayTasks = tasks.filter(t => !t.completed && t.date === today);
    const recentProperties = properties.slice(0, 3);

    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={styles.container}>
                <View style={styles.content}>


                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <View style={[styles.statCard, styles.statCardPrimary]}>
                            <Text style={[styles.statNumber, { color: Colors.primary }]}>{properties.length}</Text>
                            <Text style={styles.statLabel}>등록 매물</Text>
                        </View>
                        <View style={[styles.statCard, styles.statCardEmerald]}>
                            <Text style={[styles.statNumber, { color: Colors.emerald }]}>{clients.length}</Text>
                            <Text style={styles.statLabel}>보유 고객</Text>
                        </View>
                    </View>

                    {/* Today's Tasks */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={[styles.iconBadge, { backgroundColor: Colors.amberLight }]}>
                                <Icons.Calendar size={20} color={Colors.amber} />
                            </View>
                            <Text style={styles.sectionTitle}>오늘의 일정 ({todayTasks.length})</Text>
                        </View>

                        {todayTasks.length > 0 ? (
                            todayTasks.slice(0, 3).map(task => {
                                const taskDateTime = new Date(`${task.date}T${task.time || '00:00'}`);
                                const isOverdue = taskDateTime < now;

                                return (
                                    <View
                                        key={task.id}
                                        style={[styles.taskCard, isOverdue && styles.taskCardOverdue]}
                                    >
                                        <View style={styles.taskContent}>
                                            <Text style={[styles.taskTitle, isOverdue && styles.taskTitleOverdue]}>
                                                {task.title}
                                            </Text>
                                            <Text style={[styles.taskDate, isOverdue && styles.taskDateOverdue]}>
                                                {task.date} {task.time} {isOverdue && '(지연됨)'}
                                            </Text>
                                        </View>
                                        <View style={[styles.taskDot, isOverdue && styles.taskDotOverdue]} />
                                    </View>
                                );
                            })
                        ) : (
                            <Text style={styles.emptyText}>일정이 없습니다.</Text>
                        )}
                    </View>

                    {/* Recent Properties */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={[styles.iconBadge, { backgroundColor: Colors.blueLight }]}>
                                <Icons.Building size={20} color={Colors.blue} />
                            </View>
                            <Text style={styles.sectionTitle}>최근 등록 매물</Text>
                        </View>

                        {recentProperties.length > 0 ? (
                            recentProperties.map(prop => (
                                <TouchableOpacity
                                    key={prop.id}
                                    style={styles.propertyCard}
                                    onPress={() => router.push(`/property/${prop.id}`)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.propertyImagePlaceholder}>
                                        {prop.images && prop.images[0] ? (
                                            <Image
                                                source={{ uri: prop.images[0] }}
                                                style={styles.propertyThumbnail}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <Icons.Building size={24} color={Colors.slate300} />
                                        )}
                                    </View>
                                    <View style={styles.propertyInfo}>
                                        <Text style={styles.propertyTitle} numberOfLines={1}>{prop.title}</Text>
                                        <Text style={styles.propertyMeta}>{prop.type} • {prop.price}</Text>
                                        <Text style={styles.propertyAddress} numberOfLines={1}>{prop.address}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text style={styles.emptyText}>등록된 매물이 없습니다.</Text>
                        )}
                    </View>
                </View>
            </ScrollView>


        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.slate50,
    },
    content: {
        padding: 16,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
    },
    statCardPrimary: {
        backgroundColor: '#eef2ff',
        borderColor: '#c7d2fe',
    },
    statCardEmerald: {
        backgroundColor: Colors.emeraldLight,
        borderColor: '#a7f3d0',
    },
    statNumber: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: Colors.slate500,
        marginTop: 4,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconBadge: {
        padding: 6,
        borderRadius: 8,
        marginRight: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.slate800,
    },
    taskCard: {
        backgroundColor: Colors.white,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.slate100,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    taskCardOverdue: {
        borderColor: Colors.redLight,
    },
    taskContent: {
        flex: 1,
    },
    taskTitle: {
        fontWeight: '600',
        color: Colors.slate700,
    },
    taskTitleOverdue: {
        color: Colors.red,
    },
    taskDate: {
        fontSize: 12,
        color: Colors.slate400,
        marginTop: 2,
    },
    taskDateOverdue: {
        color: '#f87171',
        fontWeight: '500',
    },
    taskDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.amber,
        marginLeft: 8,
    },
    taskDotOverdue: {
        backgroundColor: Colors.red,
    },
    propertyCard: {
        backgroundColor: Colors.white,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.slate100,
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    propertyImagePlaceholder: {
        width: 64,
        height: 64,
        backgroundColor: Colors.slate100,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    propertyImage: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    propertyImageText: {
        fontSize: 24,
    },
    propertyInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    propertyTitle: {
        fontWeight: '600',
        color: Colors.slate800,
        fontSize: 15,
    },
    propertyMeta: {
        fontSize: 12,
        color: Colors.primary,
        fontWeight: '500',
        marginTop: 2,
    },
    propertyAddress: {
        fontSize: 10,
        color: Colors.slate400,
        marginTop: 2,
    },
    emptyText: {
        textAlign: 'center',
        color: Colors.slate400,
        paddingVertical: 16,
        fontSize: 14,
    },
    // Settings
    settingsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-end',
        padding: 8,
        backgroundColor: Colors.white,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.slate200,
        marginBottom: 16,
        gap: 6,
    },
    settingsText: {
        fontSize: 12,
        color: Colors.slate500,
        fontWeight: '500',
    },
    // Modal
    modalContainer: {
        flex: 1,
        backgroundColor: Colors.white,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.slate100,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.slate800,
    },
    modalClose: {
        color: Colors.slate400,
        fontSize: 14,
    },
    modalContent: {
        padding: 16,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.slate500,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: Colors.slate200,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 14,
        color: Colors.slate800,
        backgroundColor: Colors.white,
    },
    helpText: {
        fontSize: 12,
        color: Colors.slate400,
        marginTop: 8,
        lineHeight: 18,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 24,
    },
    saveButtonText: {
        color: Colors.white,
        fontWeight: 'bold',
        fontSize: 16,
    },
    propertyThumbnail: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
});
