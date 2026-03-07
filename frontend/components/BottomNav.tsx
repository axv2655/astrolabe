import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { router } from 'expo-router';
import { Compass, Clock, Home, User } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type Tab = 'home' | 'events' | 'explore' | 'profile';

const TABS: { key: Tab; label: string; icon: typeof Home; route: string }[] = [
  { key: 'home', label: 'Home', icon: Home, route: '/location-editor' },
  { key: 'events', label: 'Events', icon: Clock, route: '/location-editor' },
  { key: 'explore', label: 'Explore', icon: Compass, route: '/location-editor' },
  { key: 'profile', label: 'Profile', icon: User, route: '/profile' },
];

export function BottomNav({ activeTab = 'home' }: { activeTab?: Tab }) {
  return (
    <View className="absolute bottom-0 left-0 right-0 z-20 border-t border-[#2D3A4F4D] bg-[#0A0E1AF2] px-6 py-4">
      <View className="flex-row items-center justify-between">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              className="items-center gap-1"
              onPress={() => router.push(tab.route as any)}
            >
              <Icon
                as={tab.icon}
                size={24}
                className={isActive ? 'text-[#6B8DD6]' : 'text-[#4A5568]'}
              />
              <Text
                className={`text-[11px] font-medium ${isActive ? 'text-[#6B8DD6]' : 'text-[#4A5568]'}`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
