import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Icons } from '../../src/constants';
import { storage } from '../../src/storageService';
import { BrokerInfo, PropertyType } from '../../src/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';

const DEFAULT_PROPERTY_TYPE_ORDER = Object.values(PropertyType);

export default function SettingsScreen() {
    const { signOut, user } = useAuth();
    const [info, setInfo] = useState<BrokerInfo>({
        businessName: '',
        address: '',
        name: '',
        phone: '',
    });
    const [typeOrder, setTypeOrder] = useState<string[]>(DEFAULT_PROPERTY_TYPE_ORDER);
    const [areaUnit, setAreaUnit] = useState<'py' | 'm2'>('py');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const data = await storage.getBrokerInfo();
        if (data) {
            setInfo(data);
        }
        const settings = await storage.getAppSettings();
        setTypeOrder(settings.propertyTypeOrder);
        setAreaUnit(settings.defaultAreaUnit);
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });

        if (!result.canceled) {
            setInfo({ ...info, logoUri: result.assets[0].uri });
        }
    };

    const removeImage = () => {
        setInfo({ ...info, logoUri: undefined });
    };

    const handleSave = async () => {
        if (!info.businessName || !info.name) {
            Alert.alert('알림', '상호와 성명은 필수 입력입니다.');
            return;
        }
        await storage.setBrokerInfo(info);
        await storage.setAppSettings({
            propertyTypeOrder: typeOrder,
            defaultAreaUnit: areaUnit,
        });
        Alert.alert('완료', '정보가 저장되었습니다.');
    };

    const moveTypeUp = (index: number) => {
        if (index === 0) return;
        const newOrder = [...typeOrder];
        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        setTypeOrder(newOrder);
    };

    const moveTypeDown = (index: number) => {
        if (index === typeOrder.length - 1) return;
        const newOrder = [...typeOrder];
        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        setTypeOrder(newOrder);
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    <Text style={styles.headerTitle}>환경설정</Text>
                    <Text style={styles.headerSubtitle}>매물장 전달 시 표시될 정보를 입력하세요.</Text>

                    {/* --- 내 정보 설정 --- */}
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>내 정보 설정</Text>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>부동산 로고 (선택)</Text>
                            <View style={styles.logoContainer}>
                                {info.logoUri ? (
                                    <View style={styles.logoPreview}>
                                        <Image source={{ uri: info.logoUri }} style={styles.logoImage} />
                                        <TouchableOpacity style={styles.removeLogoButton} onPress={removeImage}>
                                            <Icons.X size={16} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                                        <Icons.Image size={24} color={Colors.slate400} />
                                        <Text style={styles.uploadText}>로고 등록</Text>
                                    </TouchableOpacity>
                                )}
                                <Text style={styles.helperText}>매물장 중앙에 워터마크로 표시됩니다.</Text>
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>상호 (부동산명)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="예: 행복공인중개사사무소"
                                value={info.businessName}
                                onChangeText={(text) => setInfo({ ...info, businessName: text })}
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>소재지 (주소)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="예: 서울시 강남구 테헤란로 123"
                                value={info.address}
                                onChangeText={(text) => setInfo({ ...info, address: text })}
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>성명 (대표자)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="예: 홍길동"
                                value={info.name}
                                onChangeText={(text) => setInfo({ ...info, name: text })}
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>전화번호</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="예: 010-1234-5678"
                                keyboardType="phone-pad"
                                value={info.phone}
                                onChangeText={(text) => setInfo({ ...info, phone: text })}
                            />
                        </View>
                    </View>

                    {/* --- 중개 분야 설정 --- */}
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>중개 분야 설정</Text>
                        <Text style={styles.sectionSubtitle}>매물 등록 시 '매물 구분' 순서를 조정합니다.</Text>

                        {typeOrder.map((type, index) => (
                            <View key={type} style={styles.typeOrderRow}>
                                <View style={styles.typeOrderLeft}>
                                    <View style={styles.typeOrderBadge}>
                                        <Text style={styles.typeOrderBadgeText}>{index + 1}</Text>
                                    </View>
                                    <Text style={styles.typeOrderLabel}>{type}</Text>
                                </View>
                                <View style={styles.typeOrderButtons}>
                                    <TouchableOpacity
                                        onPress={() => moveTypeUp(index)}
                                        disabled={index === 0}
                                        style={[styles.arrowButton, index === 0 && styles.arrowButtonDisabled]}
                                    >
                                        <Text style={[styles.arrowText, index === 0 && styles.arrowTextDisabled]}>▲</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => moveTypeDown(index)}
                                        disabled={index === typeOrder.length - 1}
                                        style={[styles.arrowButton, index === typeOrder.length - 1 && styles.arrowButtonDisabled]}
                                    >
                                        <Text style={[styles.arrowText, index === typeOrder.length - 1 && styles.arrowTextDisabled]}>▼</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* --- 면적 단위 설정 --- */}
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>면적 단위 설정</Text>
                        <Text style={styles.sectionSubtitle}>면적 입력 시 기본 단위를 선택합니다.</Text>

                        <View style={styles.unitRow}>
                            <TouchableOpacity
                                style={[styles.unitButton, areaUnit === 'py' && styles.unitButtonActive]}
                                onPress={() => setAreaUnit('py')}
                            >
                                <Text style={[styles.unitButtonMain, areaUnit === 'py' && styles.unitButtonMainActive]}>평</Text>
                                <Text style={[styles.unitButtonSub, areaUnit === 'py' && styles.unitButtonSubActive]}>1평 = 3.3058m²</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.unitButton, areaUnit === 'm2' && styles.unitButtonActive]}
                                onPress={() => setAreaUnit('m2')}
                            >
                                <Text style={[styles.unitButtonMain, areaUnit === 'm2' && styles.unitButtonMainActive]}>m²</Text>
                                <Text style={[styles.unitButtonSub, areaUnit === 'm2' && styles.unitButtonSubActive]}>제곱미터</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* --- 저장 버튼 --- */}
                    <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                        <Text style={styles.saveButtonText}>저장하기</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: Colors.slate500, marginTop: 12 }]}
                        onPress={async () => {
                            const { displayIncomingCallNotification } = await import('../../src/services/notificationService');
                            await displayIncomingCallNotification('테스트 고객', '이것은 테스트 메모입니다.', '2023-10-27 14:00 (3분)');
                        }}
                    >
                        <Text style={styles.saveButtonText}>알림 테스트 (5초 후 발생)</Text>
                    </TouchableOpacity>

                    {/* --- 소개 페이지 (녹화용) --- */}
                    <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: Colors.purple, marginTop: 12 }]}
                        onPress={() => {
                            // @ts-ignore
                            router.push('/intro');
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Icons.Camera size={20} color="white" />
                            <Text style={styles.saveButtonText}>소개 페이지 보기 (녹화용)</Text>
                        </View>
                    </TouchableOpacity>

                    {/* --- 로그아웃 --- */}
                    <View style={[styles.sectionCard, { marginTop: 16 }]}>
                        <Text style={styles.sectionTitle}>계정</Text>
                        {user?.email && (
                            <Text style={[styles.sectionSubtitle, { marginBottom: 12 }]}>{user.email}</Text>
                        )}
                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: '#ef4444', marginTop: 0 }]}
                            onPress={() => {
                                Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
                                    { text: '취소', style: 'cancel' },
                                    { text: '로그아웃', style: 'destructive', onPress: signOut },
                                ]);
                            }}
                        >
                            <Text style={styles.saveButtonText}>로그아웃</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.slate50 },
    content: { padding: 20, paddingBottom: 40 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.slate900, marginBottom: 8 },
    headerSubtitle: { fontSize: 14, color: Colors.slate500, marginBottom: 24 },

    // Section Card
    sectionCard: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.slate200,
        padding: 20,
        marginBottom: 16,
    },
    sectionTitle: { fontSize: 17, fontWeight: 'bold', color: Colors.slate800, marginBottom: 4 },
    sectionSubtitle: { fontSize: 13, color: Colors.slate500, marginBottom: 16 },

    formGroup: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: Colors.slate700, marginBottom: 8 },
    input: {
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.slate200,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: Colors.slate900,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

    // Logo
    logoContainer: { alignItems: 'center', marginVertical: 10 },
    logoPreview: { width: 100, height: 100, borderRadius: 50, overflow: 'hidden', borderWidth: 1, borderColor: Colors.slate200, position: 'relative' },
    logoImage: { width: '100%', height: '100%' },
    removeLogoButton: { position: 'absolute', top: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderBottomLeftRadius: 8 },
    uploadButton: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: Colors.slate300, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.slate50 },
    uploadText: { fontSize: 12, color: Colors.slate500, marginTop: 4 },
    helperText: { fontSize: 12, color: Colors.slate400, marginTop: 8 },

    // Property Type Order
    typeOrderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.slate50,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: Colors.slate100,
        marginBottom: 8,
    },
    typeOrderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    typeOrderBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#e0e7ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    typeOrderBadgeText: { fontSize: 12, fontWeight: 'bold', color: Colors.primary },
    typeOrderLabel: { fontSize: 15, fontWeight: '500', color: Colors.slate700 },
    typeOrderButtons: { flexDirection: 'row', gap: 4 },
    arrowButton: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.slate200,
    },
    arrowButtonDisabled: { opacity: 0.3 },
    arrowText: { fontSize: 12, color: Colors.slate600 },
    arrowTextDisabled: { color: Colors.slate300 },

    // Area Unit
    unitRow: { flexDirection: 'row', gap: 12 },
    unitButton: {
        flex: 1,
        paddingVertical: 20,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Colors.slate200,
        backgroundColor: Colors.white,
        alignItems: 'center',
    },
    unitButtonActive: {
        borderColor: Colors.primary,
        backgroundColor: '#eef2ff',
    },
    unitButtonMain: { fontSize: 24, fontWeight: 'bold', color: Colors.slate500, marginBottom: 4 },
    unitButtonMainActive: { color: Colors.primary },
    unitButtonSub: { fontSize: 11, color: Colors.slate400 },
    unitButtonSubActive: { color: Colors.primary },
});
