import React from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, Users, Settings } from 'lucide-react-native';
import { COLORS } from '../../components/Theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.secondary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: 'bold',
        },
        headerStyle: {
          backgroundColor: COLORS.primary,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.primaryLight,
        },
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 16,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Inicio',
          headerTitle: 'Panel TradeFlow AI',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clientes',
          headerTitle: 'Directorio de Clientes',
          tabBarIcon: ({ color, size }) => <Users size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          headerTitle: 'Configuración Comercial',
          tabBarIcon: ({ color, size }) => <Settings size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
