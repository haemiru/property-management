import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Property, Client, PropertyType, TransactionType } from '../types';
import { Icons, Colors } from '../constants';

interface PropertyDetailProps {
    property: Property;
    client?: Client;
    onBack: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onShare?: (property: Property) => void;
}

export default function PropertyDetail({
    property,
    client,
    onBack,
    onEdit,
    onDelete,
    onShare
}: PropertyDetailProps) {
    // Styles are copied from properties.tsx and adapted locally
    // Note: Some styles might need to be refined or shared via a common definition if they diverge.

    return (
        <ScrollView style={styles.container}>
            <View style={styles.detailHeader}>
                <TouchableOpacity onPress={onBack} style={{ padding: 4, marginRight: 8 }}>
                    <Icons.ChevronLeft size={24} color={Colors.slate600} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.detailTitle} numberOfLines={1}>{property.title}</Text>
                    <Text style={{ fontSize: 12, color: Colors.slate400 }}>No. {property.managementId || property.id.slice(-4)}</Text>
                </View>
                {(onEdit || onDelete) && (
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                        {onEdit && (
                            <TouchableOpacity onPress={onEdit}>
                                <Icons.Edit size={20} color={Colors.primary} />
                            </TouchableOpacity>
                        )}
                        {onDelete && (
                            <TouchableOpacity onPress={onDelete}>
                                <Icons.Trash size={20} color={Colors.red} />
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

            {/* Image */}
            <View style={styles.imageContainer}>
                {property.images[0] ? (
                    <Image source={{ uri: property.images[0] }} style={styles.detailImage} />
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <Icons.Building size={48} color={Colors.slate300} />
                    </View>
                )}
            </View>

            <View style={styles.detailContent}>
                <View style={styles.tagRow}>
                    <View style={[styles.tag, { backgroundColor: Colors.primaryLight }]}>
                        <Text style={[styles.tagText, { color: Colors.primary }]}>{property.type}</Text>
                    </View>
                    <View style={[styles.tag, { backgroundColor: property.transactionType === TransactionType.SALE ? Colors.orangeLight : Colors.emeraldLight }]}>
                        <Text style={[styles.tagText, { color: property.transactionType === TransactionType.SALE ? Colors.orange : Colors.emerald }]}>
                            {property.transactionType}
                        </Text>
                    </View>
                </View>

                <Text style={styles.priceText}>{property.price}</Text>
                <View style={styles.addressRow}>
                    <Icons.Location size={14} color={Colors.slate400} />
                    <Text style={styles.addressText}>{property.address}</Text>
                </View>

                <View style={styles.divider} />

                {/* Enhanced Details Display */}
                {(property.type === PropertyType.FACTORY_WAREHOUSE ||
                    property.type === PropertyType.LAND ||
                    property.type === PropertyType.BUILDING ||
                    property.type === PropertyType.COMMERCIAL) && (
                        <View style={{ marginBottom: 20 }}>
                            <Text style={styles.sectionLabel}>매물 상세 정보</Text>
                            <View style={{ gap: 8 }}>
                                {property.landArea && (
                                    <View style={styles.detailRow}><Text style={styles.detailLabel}>대지면적</Text><Text style={styles.detailValue}>{property.landArea} m²</Text></View>
                                )}
                                {property.buildingArea && (
                                    <View style={styles.detailRow}><Text style={styles.detailLabel}>건평</Text><Text style={styles.detailValue}>{property.buildingArea} m²</Text></View>
                                )}
                                {property.buildingUse && (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>건축물 용도</Text>
                                        <Text style={styles.detailValue}>
                                            {property.buildingUse} {property.buildingUseDetail ? `(${property.buildingUseDetail})` : ''}
                                        </Text>
                                    </View>
                                )}
                                {/* Building List Detail View */}
                                {property.buildings && property.buildings.length > 0 && (
                                    <View style={{ marginTop: 8 }}>
                                        <Text style={[styles.detailLabel, { marginBottom: 4 }]}>세부 건물 내역</Text>
                                        <View style={{ borderWidth: 1, borderColor: Colors.slate200, borderRadius: 8, overflow: 'hidden' }}>
                                            {property.buildings.map((b, idx) => (
                                                <View key={idx} style={{ flexDirection: 'row', borderBottomWidth: idx === property.buildings!.length - 1 ? 0 : 1, borderBottomColor: Colors.slate100, padding: 8, backgroundColor: idx % 2 === 0 ? Colors.slate50 : 'white' }}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: Colors.slate800 }}>{b.name}</Text>
                                                        <Text style={{ fontSize: 11, color: Colors.slate500 }}>
                                                            {b.use} | {b.structureHeight} | {b.usageApprovalDate}
                                                        </Text>
                                                    </View>
                                                    <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                                                        <Text style={{ fontSize: 13, color: Colors.slate800 }}>건평: {b.area} m²</Text>
                                                        {b.totalFloorArea ? <Text style={{ fontSize: 12, color: Colors.slate600 }}>연면적: {b.totalFloorArea} 평</Text> : null}
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}
                                {property.landUseZone && (
                                    <View style={styles.detailRow}><Text style={styles.detailLabel}>용도지역</Text><Text style={styles.detailValue}>{property.landUseZone}</Text></View>
                                )}
                                {property.landCategory && (
                                    <View style={styles.detailRow}><Text style={styles.detailLabel}>지목</Text><Text style={styles.detailValue}>{property.landCategory}</Text></View>
                                )}
                                {property.roadCondition && (
                                    <View style={styles.detailRow}><Text style={styles.detailLabel}>도로조건</Text><Text style={styles.detailValue}>{property.roadCondition}</Text></View>
                                )}
                                {property.structureHeight && (
                                    <View style={styles.detailRow}><Text style={styles.detailLabel}>구조/층고</Text><Text style={styles.detailValue}>{property.structureHeight}</Text></View>
                                )}
                                {property.usageApprovalDate && (
                                    <View style={styles.detailRow}><Text style={styles.detailLabel}>사용승인일</Text><Text style={styles.detailValue}>{property.usageApprovalDate}</Text></View>
                                )}
                                {property.water && property.water.length > 0 && (
                                    <View style={styles.detailRow}><Text style={styles.detailLabel}>수도</Text><Text style={styles.detailValue}>{property.water.join(', ')}</Text></View>
                                )}
                                {property.sewage && property.sewage.length > 0 && (
                                    <View style={styles.detailRow}><Text style={styles.detailLabel}>하수처리</Text><Text style={styles.detailValue}>{property.sewage.join(', ')}</Text></View>
                                )}
                            </View>
                        </View>
                    )}

                <View style={styles.divider} />

                <Text style={styles.sectionLabel}>매물 상세 설명</Text>
                <View style={styles.descriptionBox}>
                    <Text style={styles.descriptionText}>
                        {property.description || '설명이 등록되지 않았습니다.'}
                    </Text>
                </View>

                {client && (
                    <>
                        <Text style={styles.sectionLabel}>연결된 고객</Text>
                        <View style={styles.clientCard}>
                            <View style={styles.clientIcon}>
                                <Icons.Users size={20} color={Colors.primary} />
                            </View>
                            <View style={styles.clientInfo}>
                                <Text style={styles.clientName}>{client.name}</Text>
                                <Text style={styles.clientRole}>{client.role}</Text>
                            </View>
                        </View>
                    </>
                )}

                <Text style={styles.metaText}>
                    등록일: {new Date(property.createdAt).toLocaleString()}
                </Text>

                {onShare && (
                    <TouchableOpacity style={styles.reportButton} onPress={() => onShare(property)}>
                        <Icons.Share size={20} color={Colors.white} />
                        <Text style={styles.reportButtonText}>매물장 전달 (이미지)</Text>
                    </TouchableOpacity>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.slate50 },
    detailHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
    detailTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', color: Colors.slate800 },
    imageContainer: { height: 256, backgroundColor: Colors.slate100 },
    detailImage: { width: '100%', height: '100%' },
    imagePlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    detailContent: { padding: 16 },
    tagRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    tagText: { fontSize: 10, fontWeight: 'bold' },
    priceText: { fontSize: 24, fontWeight: 'bold', color: Colors.slate900, marginBottom: 4 },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    addressText: { fontSize: 14, color: Colors.slate500 },
    divider: { height: 1, backgroundColor: Colors.slate100, marginVertical: 16 },
    sectionLabel: { fontWeight: 'bold', color: Colors.slate800, marginBottom: 8, marginTop: 8 },
    descriptionBox: { backgroundColor: Colors.slate50, padding: 16, borderRadius: 16 },
    descriptionText: { fontSize: 14, color: Colors.slate700, lineHeight: 22 },
    clientCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.slate100, gap: 12 },
    clientIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.slate50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primaryLight },
    clientInfo: { flex: 1 },
    clientName: { fontWeight: 'bold', color: Colors.slate800 },
    clientRole: { fontSize: 12, color: Colors.slate500 },
    metaText: { fontSize: 10, color: Colors.slate300, textAlign: 'center', marginTop: 24 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
    detailLabel: { fontSize: 14, color: Colors.slate500 },
    detailValue: { fontSize: 14, color: Colors.slate800, fontWeight: '500' },
    reportButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.slate800, padding: 16, borderRadius: 12, marginTop: 24, gap: 8, marginBottom: 40 },
    reportButtonText: { color: Colors.white, fontWeight: 'bold', fontSize: 16 },
});
