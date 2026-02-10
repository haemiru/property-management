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
    RefreshControl,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ScheduleTask, Client } from '../../src/types';
import { storage } from '../../src/storageService';
import { Icons, Colors } from '../../src/constants';
import { useFocusEffect } from 'expo-router';

export default function ScheduleScreen() {
    const [tasks, setTasks] = useState<ScheduleTask[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Date/Time picker states
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedTime, setSelectedTime] = useState(new Date());

    const [formState, setFormState] = useState<Partial<ScheduleTask>>({
        date: new Date().toISOString().split('T')[0],
        time: '14:00',
    });

    useFocusEffect(
        useCallback(() => {
            loadData();
            return () => {
                setIsModalOpen(false);
                setEditingTaskId(null);
            };
        }, [])
    );

    const loadData = async () => {
        const [tsks, clnts] = await Promise.all([
            storage.getTasks(),
            storage.getClients(),
        ]);
        setTasks(tsks);
        setClients(clnts);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleOpenAddModal = () => {
        setEditingTaskId(null);
        const now = new Date();
        // 로컬 날짜 형식 (YYYY-MM-DD)
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        // 현재 시간 (HH:MM)
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        setSelectedDate(now);
        setSelectedTime(now);
        setFormState({
            date: todayStr,
            time: currentTime,
        });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (task: ScheduleTask) => {
        setEditingTaskId(task.id);
        // Parse date and time
        const [year, month, day] = task.date.split('-').map(Number);
        const [hour, minute] = (task.time || '14:00').split(':').map(Number);
        setSelectedDate(new Date(year, month - 1, day));
        setSelectedTime(new Date(2000, 0, 1, hour, minute));
        setFormState({
            title: task.title,
            date: task.date,
            time: task.time,
            clientId: task.clientId,
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!formState.title || !formState.date) {
            Alert.alert('알림', '일정 내용과 날짜를 입력해주세요.');
            return;
        }

        let newTasks: ScheduleTask[];

        if (editingTaskId) {
            newTasks = tasks.map(t =>
                t.id === editingTaskId
                    ? {
                        ...t,
                        title: formState.title!,
                        date: formState.date!,
                        time: formState.time || '',
                        clientId: formState.clientId,
                    }
                    : t
            );
            // Find the updated task object
            const updatedTask = newTasks.find(t => t.id === editingTaskId);
            if (updatedTask) await storage.updateTask(updatedTask);
        } else {
            const newTask: ScheduleTask = {
                id: Date.now().toString(),
                title: formState.title!,
                date: formState.date!,
                time: formState.time || '',
                clientId: formState.clientId,
                completed: false,
            };
            newTasks = [newTask, ...tasks];
            await storage.addTask(newTask);
        }

        setTasks(newTasks);
        // await storage.setTasks(newTasks);
        setIsModalOpen(false);
    };

    const handleToggle = async (id: string) => {
        const newTasks = tasks.map(t =>
            t.id === id ? { ...t, completed: !t.completed } : t
        );
        setTasks(newTasks);

        const updatedTask = newTasks.find(t => t.id === id);
        if (updatedTask) await storage.updateTask(updatedTask);
    };

    const handleDelete = async (id: string) => {
        Alert.alert('삭제 확인', '정말로 이 일정을 삭제하시겠습니까?', [
            { text: '취소', style: 'cancel' },
            {
                text: '삭제',
                style: 'destructive',
                onPress: async () => {
                    const newTasks = tasks.filter(t => t.id !== id);
                    setTasks(newTasks);
                    await storage.deleteTask(id);
                },
            },
        ]);
    };

    const sortedTasks = [...tasks].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
    });

    const now = new Date();

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {sortedTasks.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Icons.Calendar size={32} color={Colors.slate300} />
                        <Text style={styles.emptyText}>일정이 비어있습니다.</Text>
                    </View>
                ) : (
                    sortedTasks.map(task => {
                        const client = clients.find(c => c.id === task.clientId);
                        const taskDateTime = new Date(`${task.date}T${task.time || '00:00'}`);
                        const isOverdue = !task.completed && taskDateTime < now;

                        return (
                            <View
                                key={task.id}
                                style={[
                                    styles.taskCard,
                                    task.completed && styles.taskCardCompleted,
                                    isOverdue && styles.taskCardOverdue,
                                ]}
                            >
                                <TouchableOpacity
                                    style={[
                                        styles.checkbox,
                                        task.completed && styles.checkboxCompleted,
                                        isOverdue && !task.completed && styles.checkboxOverdue,
                                    ]}
                                    onPress={() => handleToggle(task.id)}
                                >
                                    {task.completed && (
                                        <Text style={styles.checkmark}>✓</Text>
                                    )}
                                    {isOverdue && !task.completed && (
                                        <View style={styles.overdueDot} />
                                    )}
                                </TouchableOpacity>

                                <View style={styles.taskContent}>
                                    <Text
                                        style={[
                                            styles.taskTitle,
                                            task.completed && styles.taskTitleCompleted,
                                            isOverdue && !task.completed && styles.taskTitleOverdue,
                                        ]}
                                    >
                                        {task.title}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.taskDate,
                                            isOverdue && !task.completed && styles.taskDateOverdue,
                                        ]}
                                    >
                                        {task.date} {task.time} {isOverdue && !task.completed && '(기한 만료)'}
                                    </Text>
                                    {client && (
                                        <View style={styles.clientBadge}>
                                            <Icons.Users size={12} color={Colors.slate500} />
                                            <Text style={styles.clientBadgeText}>
                                                {client.name} ({client.phone})
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.taskActions}>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => handleOpenEditModal(task)}
                                    >
                                        <Icons.Edit size={16} color={Colors.slate300} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => handleDelete(task.id)}
                                    >
                                        <Icons.Trash size={16} color={Colors.slate300} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={handleOpenAddModal}>
                <Icons.Plus size={24} color={Colors.white} />
            </TouchableOpacity>

            {/* Modal */}
            <Modal visible={isModalOpen} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingTaskId ? '일정 수정' : '일정 추가'}
                            </Text>
                            <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                                <Text style={styles.modalClose}>닫기</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalContent}>
                            <Text style={styles.label}>일정 내용</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="예: 미팅, 현장 방문 등"
                                value={formState.title || ''}
                                onChangeText={text => setFormState({ ...formState, title: text })}
                                placeholderTextColor={Colors.slate400}
                            />

                            <View style={styles.row}>
                                <View style={styles.halfField}>
                                    <Text style={styles.label}>날짜</Text>
                                    <TouchableOpacity
                                        style={styles.pickerButton}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <Icons.Calendar size={16} color={Colors.slate500} />
                                        <Text style={styles.pickerButtonText}>{formState.date}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.halfField}>
                                    <Text style={styles.label}>시간</Text>
                                    <TouchableOpacity
                                        style={styles.pickerButton}
                                        onPress={() => setShowTimePicker(true)}
                                    >
                                        <Text style={styles.pickerButtonText}>{formState.time || '14:00'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {showDatePicker && (
                                <DateTimePicker
                                    value={selectedDate}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(event, date) => {
                                        setShowDatePicker(Platform.OS === 'ios');
                                        if (date) {
                                            setSelectedDate(date);
                                            // 로컬 날짜 형식 (YYYY-MM-DD)
                                            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                            setFormState({ ...formState, date: dateStr });
                                        }
                                    }}
                                />
                            )}

                            {showTimePicker && (
                                <DateTimePicker
                                    value={selectedTime}
                                    mode="time"
                                    is24Hour={true}
                                    display="spinner"
                                    onChange={(event, time) => {
                                        setShowTimePicker(Platform.OS === 'ios');
                                        if (time) {
                                            setSelectedTime(time);
                                            const hours = time.getHours().toString().padStart(2, '0');
                                            const minutes = time.getMinutes().toString().padStart(2, '0');
                                            setFormState({ ...formState, time: `${hours}:${minutes}` });
                                        }
                                    }}
                                />
                            )}

                            <Text style={styles.label}>관련 고객 (선택)</Text>
                            <View style={styles.clientSelector}>
                                <TouchableOpacity
                                    style={[styles.clientOption, !formState.clientId && styles.clientOptionActive]}
                                    onPress={() => setFormState({ ...formState, clientId: undefined })}
                                >
                                    <Text style={[styles.clientOptionText, !formState.clientId && styles.clientOptionTextActive]}>
                                        선택 없음
                                    </Text>
                                </TouchableOpacity>
                                {clients.slice(0, 6).map(client => (
                                    <TouchableOpacity
                                        key={client.id}
                                        style={[styles.clientOption, formState.clientId === client.id && styles.clientOptionActive]}
                                        onPress={() => setFormState({ ...formState, clientId: client.id })}
                                    >
                                        <Text style={[styles.clientOptionText, formState.clientId === client.id && styles.clientOptionTextActive]}>
                                            {client.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.submitButton, editingTaskId && styles.submitButtonEdit]}
                                onPress={handleSubmit}
                            >
                                <Text style={styles.submitButtonText}>
                                    {editingTaskId ? '수정 완료' : '일정 추가하기'}
                                </Text>
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
    list: { flex: 1, padding: 16 },
    fab: { position: 'absolute', bottom: 90, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.amber, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    emptyContainer: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { marginTop: 8, color: Colors.slate400, fontSize: 14 },
    taskCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.white, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.slate100 },
    taskCardCompleted: { backgroundColor: Colors.slate50, opacity: 0.6 },
    taskCardOverdue: { borderColor: Colors.redLight },
    checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: Colors.slate300, marginRight: 12, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
    checkboxCompleted: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    checkboxOverdue: { borderColor: Colors.red, backgroundColor: Colors.white },
    checkmark: { color: Colors.white, fontSize: 12, fontWeight: 'bold' },
    overdueDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.red },
    taskContent: { flex: 1 },
    taskTitle: { fontWeight: 'bold', color: Colors.slate800, fontSize: 15 },
    taskTitleCompleted: { textDecorationLine: 'line-through', color: Colors.slate400 },
    taskTitleOverdue: { color: Colors.red },
    taskDate: { fontSize: 12, color: Colors.slate400, marginTop: 2 },
    taskDateOverdue: { color: '#f87171', fontWeight: '500' },
    clientBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.slate100, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 8, alignSelf: 'flex-start', gap: 4 },
    clientBadgeText: { fontSize: 10, color: Colors.slate600 },
    taskActions: { gap: 12 },
    actionButton: { padding: 4 },
    // Modal
    modalContainer: { flex: 1, backgroundColor: Colors.white },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.slate800 },
    modalClose: { color: Colors.slate400, fontSize: 14 },
    modalContent: { padding: 16 },
    label: { fontSize: 12, fontWeight: '600', color: Colors.slate500, textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
    input: { borderWidth: 1, borderColor: Colors.slate200, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.slate800, backgroundColor: Colors.white },
    row: { flexDirection: 'row', gap: 12 },
    halfField: { flex: 1 },
    clientSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    clientOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.slate200, backgroundColor: Colors.white },
    clientOptionActive: { backgroundColor: Colors.amber, borderColor: Colors.amber },
    clientOptionText: { fontSize: 13, color: Colors.slate600 },
    clientOptionTextActive: { color: Colors.white, fontWeight: '600' },
    submitButton: { backgroundColor: Colors.amber, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
    submitButtonEdit: { backgroundColor: Colors.primary },
    submitButtonText: { color: Colors.white, fontWeight: 'bold', fontSize: 16 },
    // Date/Time Picker
    pickerButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.slate200, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: Colors.white },
    pickerButtonText: { fontSize: 14, color: Colors.slate800 },
});
