import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Icons } from '../../src/constants';
import { storage } from '../../src/storageService';
import { BrokerInfo } from '../../src/types';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
    const [info, setInfo] = useState<BrokerInfo>({
        businessName: '',
        address: '',
        name: '',
        phone: '',
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const data = await storage.getBrokerInfo();
        if (data) {
            setInfo(data);
        }
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
        Alert.alert('완료', '정보가 저장되었습니다.');
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    <Text style={styles.headerTitle}>내 정보 설정</Text>
                    <Text style={styles.headerSubtitle}>매물장 전달 시 표시될 정보를 입력하세요.</Text>

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
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.slate50 },
    content: { padding: 20 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.slate900, marginBottom: 8 },
    headerSubtitle: { fontSize: 14, color: Colors.slate500, marginBottom: 32 },
    formGroup: { marginBottom: 20 },
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
        marginTop: 20,
    },
    saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    // Logo Styles
    logoContainer: { alignItems: 'center', marginVertical: 10 },
    logoPreview: { width: 100, height: 100, borderRadius: 50, overflow: 'hidden', borderWidth: 1, borderColor: Colors.slate200, position: 'relative' },
    logoImage: { width: '100%', height: '100%' },
    removeLogoButton: { position: 'absolute', top: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderBottomLeftRadius: 8 },
    uploadButton: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: Colors.slate300, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.slate50 },
    uploadText: { fontSize: 12, color: Colors.slate500, marginTop: 4 },
    helperText: { fontSize: 12, color: Colors.slate400, marginTop: 8 },
});
