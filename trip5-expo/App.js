import React, { Component, useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { lightColors } from './src/theme';
import AppLoadingScreen from './src/components/AppLoadingScreen';
import { ThemeProvider } from './src/context/ThemeContext';
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
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: lightColors.background }}>
          <Text style={{ fontSize: 18, marginBottom: 12, color: lightColors.text }}>Something went wrong</Text>
          <Text style={{ color: lightColors.textSecondary, fontSize: 14 }}>{String(this.state.error)}</Text>
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
    return <AppLoadingScreen />;
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
        <ThemeProvider>
          <AuthProvider>
            <Root />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
