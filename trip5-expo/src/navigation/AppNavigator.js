import React, { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { OrderProvider } from '../context/OrderContext';
import { LocaleTabContext } from '../context/LocaleTabContext';
import DashboardScreen from '../screens/DashboardScreen';
import ActivityScreen from '../screens/ActivityScreen';
import AccountScreen from '../screens/AccountScreen';
import BookingFlowScreen from '../screens/BookingFlowScreen';
import SavedPlacesScreen from '../screens/SavedPlacesScreen';
import TripTrackingScreen from '../screens/TripTrackingScreen';
import { colors } from '../theme';
import i18n from '../i18n';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function BookingStackScreen(props) {
  return (
    <OrderProvider>
      <BookingFlowScreen {...props} />
    </OrderProvider>
  );
}

function MainTabs() {
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  return (
    <LocaleTabContext.Provider value={bump}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.placeholder,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingTop: 4,
            paddingBottom: Platform.OS === 'ios' ? 20 : 8,
            height: Platform.OS === 'ios' ? 88 : 64,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        }}
      >
        <Tab.Screen
          name="Home"
          component={DashboardScreen}
          options={{
            tabBarLabel: i18n.t('tab_home'),
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="Activity"
          component={ActivityScreen}
          options={{
            tabBarLabel: i18n.t('tab_activity'),
            tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="Account"
          component={AccountScreen}
          options={{
            tabBarLabel: i18n.t('tab_account'),
            tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          }}
        />
      </Tab.Navigator>
    </LocaleTabContext.Provider>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Main" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Booking" component={BookingStackScreen} />
        <Stack.Screen name="TripTracking" component={TripTrackingScreen} />
        <Stack.Screen name="SavedPlaces" component={SavedPlacesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
