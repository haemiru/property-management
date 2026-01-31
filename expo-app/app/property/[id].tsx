import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Property, Client } from '../../src/types';
import { storage } from '../../src/storage';
import { Colors } from '../../src/constants';
import PropertyDetail from '../../src/components/PropertyDetail';

export default function GlobalPropertyDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [property, setProperty] = useState<Property | null>(null);
    const [client, setClient] = useState<Client | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        if (!id || typeof id !== 'string') return;
        setLoading(true);
        try {
            const props = await storage.getProperties();
            const found = props.find(p => p.id === id);
            if (found) {
                setProperty(found);
                if (found.clientId) {
                    const clients = await storage.getClients();
                    const cl = clients.find(c => c.id === found.clientId);
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
        <PropertyDetail
            property={property}
            client={client}
            onBack={() => router.back()}
            // No edit/delete/share handlers here for read-only mode by default
            // If share is needed, it can be added.
            onShare={(prop) => {
                // For now, maybe just log or do nothing, or implement share logic if needed globaly
                // To keep it simple and consistent with "Read Only", we might omit it or implement later.
                // But since the original plan said "Read Only", we leave edit/delete out.
            }}
        />
    );
}
