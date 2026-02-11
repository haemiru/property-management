// Custom entry point: register headless tasks BEFORE expo-router loads
import './src/services/callHeadlessTask';
import 'expo-router/entry';
