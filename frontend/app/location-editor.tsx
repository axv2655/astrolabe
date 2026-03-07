import { BottomNav } from '@/components/BottomNav';
import { StarBackground } from '@/components/StarBackground';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { router } from 'expo-router';
import { ArrowLeft, Building, Calendar, Search } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

const recentItems = [
  {
    name: 'ECSW 1.315',
    subtitle: 'Engineering & Computer Science West',
    date: 'Apr 1, 2025',
    time: '9:41 AM',
  },
  {
    name: 'JO 1.355',
    subtitle: 'Jonsson Performance Hall',
    date: 'Apr 1, 2025',
    time: '9:41 AM',
  },
];

const upcomingEvents = [
  {
    name: 'ECSW 1.315',
    subtitle: 'CS 3305 — Algorithms',
    date: 'Apr 1, 2025',
    time: '9:41 AM',
  },
  {
    name: 'JO 1.355',
    subtitle: 'Hackathon Kickoff',
    date: 'Apr 1, 2025',
    time: '9:41 AM',
  },
];

export default function LocationEditorScreen() {
  const [destination, setDestination] = React.useState('');

  return (
    <View className="flex-1 bg-[#0A0E1A]">
      <StarBackground />

      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        className="absolute left-5 top-14 z-20 h-10 w-10 items-center justify-center rounded-full border border-[#2D3A4F80] bg-[#1A233299]"
      >
        <Icon as={ArrowLeft} size={18} className="text-[#6B8DD6]" />
      </Pressable>

      {/* Header */}
      <View className="z-10 px-6 pb-6 pt-14">
        <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-[#6B8DD6]">
          GOOD MORNING
        </Text>
        <Text className="mb-6 text-[32px] font-bold leading-tight tracking-tight text-white">
          Where are you{'\n'}headed today?
        </Text>

        {/* Search bar */}
        <View className="flex-row items-center gap-3 rounded-xl border border-[#2D3A4F80] bg-[#1A233280] px-4 py-3.5">
          <Icon as={Search} size={20} className="text-[#4A5568]" />
          <TextInput
            placeholder="Enter destination or room code"
            placeholderTextColor="#4A5568"
            value={destination}
            onChangeText={setDestination}
            className="flex-1 text-[15px] text-white"
          />
        </View>
      </View>

      {/* Scrollable content */}
      <ScrollView className="z-10 flex-1 px-6" contentContainerStyle={{ paddingBottom: 96 }}>
        {/* Recent section */}
        <View className="mb-8">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7885]">
              RECENT
            </Text>
            <Pressable>
              <Text className="text-[13px] font-medium text-[#6B8DD6]">
                Clear all
              </Text>
            </Pressable>
          </View>
          <View className="gap-3">
            {recentItems.map((item, index) => (
              <Pressable
                key={index}
                onPress={() => router.push('/map')}
                className="flex-row items-center gap-4 rounded-2xl border border-[#2D3A4F66] bg-[#1A233266] px-4 py-4"
              >
                <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#6B8DD633]">
                  <Icon as={Building} size={20} className="text-[#6B8DD6]" />
                </View>
                <View className="flex-1">
                  <Text className="mb-0.5 text-[15px] font-semibold text-white">
                    {item.name}
                  </Text>
                  <Text className="text-[13px] text-[#6B7885]">
                    {item.subtitle}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs text-[#6B7885]">{item.date}</Text>
                  <Text className="text-xs text-[#6B7885]">{item.time}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Upcoming Events section */}
        <View className="mb-8">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7885]">
              UPCOMING EVENTS
            </Text>
            <Pressable>
              <Text className="text-[13px] font-medium text-[#6B8DD6]">
                See all
              </Text>
            </Pressable>
          </View>
          <View className="gap-3">
            {upcomingEvents.map((item, index) => (
              <Pressable
                key={index}
                onPress={() => router.push('/map')}
                className="flex-row items-center gap-4 rounded-2xl border border-[#2D3A4F66] bg-[#1A233266] px-4 py-4"
              >
                <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#A474D433]">
                  <Icon as={Calendar} size={20} className="text-[#A474D4]" />
                </View>
                <View className="flex-1">
                  <Text className="mb-0.5 text-[15px] font-semibold text-white">
                    {item.name}
                  </Text>
                  <Text className="text-[13px] text-[#6B7885]">
                    {item.subtitle}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs text-[#6B7885]">{item.date}</Text>
                  <Text className="text-xs text-[#6B7885]">{item.time}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <BottomNav activeTab="home" />
    </View>
  );
}
