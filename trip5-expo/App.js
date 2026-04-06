import React, { Component, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from './src/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import DriverAuthScreen from './src/screens/DriverAuthScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import AppNavigator from './src/navigation/AppNavigator';
import DriverAppNavigator from './src/navigation/DriverAppNavigator';

class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
          <Text style={{ fontSize: 18, marginBottom: 12, color: colors.text }}>Something went wrong</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{String(this.state.error)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function Root() {
  const { session, loading, profileLoading, needsProfile, isDriver } = useAuth();
  const [authFlow, setAuthFlow] = useState('passenger');

  useEffect(() => {
    if (!session?.user) {
      setAuthFlow('passenger');
    }
  }, [session?.user]);

  if (loading || (session?.user && profileLoading)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!session?.user) {
    if (authFlow === 'driver') {
      return <DriverAuthScreen onBack={() => setAuthFlow('passenger')} />;
    }
    return <AuthScreen onPressDriver={() => setAuthFlow('driver')} />;
  }
  if (needsProfile) {
    return <ProfileSetupScreen />;
  }
  if (isDriver) {
    return <DriverAppNavigator />;
  }
  return <AppNavigator />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
});
