import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Property, Client, BrokerInfo } from '../../src/types';
import { storage } from '../../src/storageService';
import { Colors } from '../../src/constants';
import PropertyDetail from '../../src/components/PropertyDetail';
import PropertyShareModal from '../../src/components/PropertyShareModal';

export default function GlobalPropertyDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [property, setProperty] = useState<Property | null>(null);
    const [client, setClient] = useState<Client | undefined>(undefined);
    const [clients, setClients] = useState<Client[]>([]);
    const [brokerInfo, setBrokerInfo] = useState<BrokerInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [showShareModal, setShowShareModal] = useState(false);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        if (!id || typeof id !== 'string') return;
        setLoading(true);
        try {
            const props = await storage.getProperties();
            const found = props.find(p => p.id === id);

            // Load Broker Info
            const broker = await storage.getBrokerInfo();
            setBrokerInfo(broker);

            // Load Clients
            const allClients = await storage.getClients();
            setClients(allClients);

            if (found) {
                setProperty(found);
                if (found.clientId) {
                    const cl = allClients.find(c => c.id === found.clientId);
                    setClient(cl);
                }
            }
        } catch (e) {
            console.error('Failed to load property detail', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (!property) {
        return null; // Or some error view
    }

    return (
        <View style={{ flex: 1, paddingTop: 50, backgroundColor: Colors.white }}>
            <PropertyDetail
                property={property}
                client={client}
                onBack={() => router.back()}
                onShare={(prop) => {
                    setShowShareModal(true);
                }}
            />
            <PropertyShareModal
                visible={showShareModal}
                onClose={() => setShowShareModal(false)}
                property={property}
                clients={clients}
                brokerInfo={brokerInfo}
            />
        </View>
    );
}
