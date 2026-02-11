import AsyncStorage from '@react-native-async-storage/async-storage';
import { Property, Client, ScheduleTask, BrokerInfo, PropertyType } from './types';
import { supabase } from './lib/supabase';
import { NativeModules, Platform } from 'react-native';

// Sync client data to SharedPreferences for native CallReceiver access
const syncClientsToNative = (clients: Client[]) => {
    if (Platform.OS !== 'android') return;
    try {
        const { NativeStorageBridge } = NativeModules;
        if (NativeStorageBridge) {
            NativeStorageBridge.syncClients(JSON.stringify(clients));
        }
    } catch (e) {
        console.error('Failed to sync clients to native:', e);
    }
};

// Simple UUID generator to avoid native module dependencies
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const KEYS = {
    BROKER_INFO: 'realtor_broker_info',
    CLIENTS_CACHE: 'realtor_clients_cache',
    APP_SETTINGS: 'app_settings',
};

export const storage = {
    // PROPERTIES
    async getProperties(): Promise<Property[]> {
        const { data, error } = await supabase
            .from('properties')
            .select('*')
            .order('updated_at', { ascending: false, nullsFirst: false });

        if (error) {
            console.error('Error fetching properties:', error);
            return [];
        }

        // Fix potential type mismatches (e.g. JSONB columns) if necessary
        return (data || []) as any as Property[];
    },

    async addProperty(property: Property): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('properties')
            .insert([{ ...property, user_id: user.id }]);

        if (error) throw error;
    },

    async deleteProperty(id: string): Promise<void> {
        const { error } = await supabase
            .from('properties')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // CLIENTS
    async getClients(): Promise<Client[]> {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            // Sort by updated_at DESC, keeping nulls (if any) at bottom or treating them as old
            .order('updated_at', { ascending: false, nullsFirst: false });

        if (error) {
            console.error('Error fetching clients:', error);
            // Try to return cached data on error if possible
            return await this.getCachedClients();
        }

        const clients = (data || []) as any as Client[];
        // Update cache
        try {
            const jsonStr = JSON.stringify(clients);
            await AsyncStorage.setItem(KEYS.CLIENTS_CACHE, jsonStr);
            syncClientsToNative(clients);
        } catch (e) {
            console.error('Failed to cache clients:', e);
        }

        return clients;
    },

    async getCachedClients(): Promise<Client[]> {
        try {
            const data = await AsyncStorage.getItem(KEYS.CLIENTS_CACHE);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to get cached clients:', e);
            return [];
        }
    },

    async addClient(client: Omit<Client, 'id'>): Promise<Client> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Generate ID client-side using pure JS to avoid native module issues
        const newId = generateUUID();

        const newClient = { ...client, id: newId, user_id: user.id };

        const { error } = await supabase
            .from('clients')
            .insert([newClient]);

        if (error) {
            // PGRST204: No Content (Success for insert without return)
            if (error.code === 'PGRST204') {
                // Success, continue
            } else {
                console.error('Error adding client:', error);
                throw error;
            }
        }

        const savedClient = {
            id: newId,
            name: client.name,
            phone: client.phone,
            role: client.role,
            notes: client.notes,
            call_history: client.call_history,
            updated_at: new Date().toISOString() // Manually set for local cache
        } as Client;

        // Update Cache
        try {
            const cached = await this.getCachedClients();
            const updated = [savedClient, ...cached];
            await AsyncStorage.setItem(KEYS.CLIENTS_CACHE, JSON.stringify(updated));
            syncClientsToNative(updated);
        } catch (e) {
            console.error('Failed to update client cache (add):', e);
        }

        return savedClient;
    },

    async updateClient(client: Client): Promise<void> {
        const { error } = await supabase
            .from('clients')
            .update({
                name: client.name,
                phone: client.phone,
                role: client.role,
                notes: client.notes,
                call_history: client.call_history
            })
            .eq('id', client.id);

        if (error) {
            // PGRST204: No Content (Success for update without return)
            if (error.code === 'PGRST204') {
                // Success, continue
            } else {
                throw error;
            }
        }

        // Update Cache
        try {
            const clientWithTimestamp = { ...client, updated_at: new Date().toISOString() };
            const cached = await this.getCachedClients();
            // Move updated item to TOP
            const otherClients = cached.filter(c => c.id !== client.id);
            const updated = [clientWithTimestamp, ...otherClients];

            await AsyncStorage.setItem(KEYS.CLIENTS_CACHE, JSON.stringify(updated));
            syncClientsToNative(updated);
        } catch (e) {
            console.error('Failed to update client cache (update):', e);
        }
    },

    async deleteClient(id: string): Promise<void> {
        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', id);
        if (error) throw error;

        // Update Cache
        try {
            const cached = await this.getCachedClients();
            const updated = cached.filter(c => c.id !== id);
            await AsyncStorage.setItem(KEYS.CLIENTS_CACHE, JSON.stringify(updated));
            syncClientsToNative(updated);
        } catch (e) {
            console.error('Failed to update client cache (delete):', e);
        }
    },

    // TASKS
    async getTasks(): Promise<ScheduleTask[]> {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching tasks:', error);
            return [];
        }
        return (data || []) as any as ScheduleTask[];
    },

    async addTask(task: ScheduleTask): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('tasks')
            .insert([{ ...task, user_id: user.id }]);

        if (error) throw error;
    },

    async updateTask(task: ScheduleTask): Promise<void> {
        const { error } = await supabase
            .from('tasks')
            .update(task)
            .eq('id', task.id);
        if (error) throw error;
    },

    async deleteTask(id: string): Promise<void> {
        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // BROKER INFO (Keep Local for now)

    async getBrokerInfo(): Promise<BrokerInfo | null> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const data = await AsyncStorage.getItem(`${KEYS.BROKER_INFO}_${user.id}`);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    async setBrokerInfo(info: BrokerInfo): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await AsyncStorage.setItem(`${KEYS.BROKER_INFO}_${user.id}`, JSON.stringify(info));
    },

    // Helper for background services
    async updateLocalCache(clients: Client[]): Promise<void> {
        try {
            await AsyncStorage.setItem(KEYS.CLIENTS_CACHE, JSON.stringify(clients));
            syncClientsToNative(clients);
        } catch (e) {
            console.error('Failed to manually update cache:', e);
        }
    },

    // APP SETTINGS
    async getAppSettings(): Promise<{ propertyTypeOrder: string[]; defaultAreaUnit: 'py' | 'm2' }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { propertyTypeOrder: Object.values(PropertyType), defaultAreaUnit: 'py' };

            const data = await AsyncStorage.getItem(`${KEYS.APP_SETTINGS}_${user.id}`);
            if (data) {
                const parsed = JSON.parse(data);
                const allTypes = Object.values(PropertyType);
                const savedOrder: string[] = parsed.propertyTypeOrder || [];
                const finalOrder = [
                    ...savedOrder.filter((t: string) => allTypes.includes(t as PropertyType)),
                    ...allTypes.filter(t => !savedOrder.includes(t)),
                ];
                return {
                    propertyTypeOrder: finalOrder,
                    defaultAreaUnit: parsed.defaultAreaUnit || 'py',
                };
            }
        } catch (e) {
            console.error('Failed to get app settings:', e);
        }
        return { propertyTypeOrder: Object.values(PropertyType), defaultAreaUnit: 'py' };
    },

    async setAppSettings(settings: { propertyTypeOrder: string[]; defaultAreaUnit: 'py' | 'm2' }): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await AsyncStorage.setItem(`${KEYS.APP_SETTINGS}_${user.id}`, JSON.stringify(settings));
    }
};
