import { StarBackground } from '@/components/StarBackground';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { router } from 'expo-router';
import { ArrowLeft, MapPin, Moon, Sun, Trash2, User } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

function ChevronRight() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M7.5 15L12.5 10L7.5 5"
        stroke="#4A5568"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SettingsRow({
  icon,
  label,
  iconColor = '#6B8DD6',
  iconBg = '#6B8DD633',
  labelColor = 'text-white',
  trailing,
  onPress,
}: {
  icon: typeof User;
  label: string;
  iconColor?: string;
  iconBg?: string;
  labelColor?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-4 rounded-2xl border border-[#2D3A4F66] bg-[#1A233266] px-5 py-4"
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: iconBg }}
      >
        <Icon as={icon} size={20} color={iconColor} />
      </View>
      <Text className={`flex-1 font-lato text-[15px] ${labelColor}`}>
        {label}
      </Text>
      {trailing ?? <ChevronRight />}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const [lightMode, setLightMode] = React.useState(false);
  const [voiceAssistance, setVoiceAssistance] = React.useState(true);

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

      {/* Scrollable content */}
      <ScrollView className="z-10 flex-1 px-6" contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header */}
        <View className="pb-8 pt-14">
          <Text className="font-lato-bold text-center text-[11px] uppercase tracking-widest text-[#4A5568]">
            PROFILE
          </Text>
        </View>

        {/* Profile avatar and name */}
        <View className="mb-10 items-center">
          <View className="mb-4 h-24 w-24 items-center justify-center rounded-full border border-[#3D4A5F80] bg-[#2D3A4F99]">
            <Text className="font-lato-bold text-[32px] text-white">JD</Text>
          </View>
          <Text className="font-instrument mb-4 text-[28px] text-white">Gooner</Text>
          <View className="flex-row gap-2">
            <View className="rounded-full border border-[#2D3A4F66] bg-[#1A233280] px-4 py-1.5">
              <Text className="font-lato text-[13px] text-[#6B8DD6]">
                CS Major
              </Text>
            </View>
            <View className="rounded-full border border-[#2D3A4F66] bg-[#1A233280] px-4 py-1.5">
              <Text className="font-lato text-[13px] text-[#6B8DD6]">
                Freshman
              </Text>
            </View>
          </View>
        </View>

        {/* Account Section */}
        <View className="mb-8">
          <Text className="font-lato-bold mb-4 text-[11px] uppercase tracking-widest text-[#4A5568]">
            ACCOUNT
          </Text>
          <View className="gap-3">
            <SettingsRow icon={User} label="Edit profile" />
            <SettingsRow icon={MapPin} label="User location" />
          </View>
        </View>

        {/* Preferences Section */}
        <View className="mb-8">
          <Text className="font-lato-bold mb-4 text-[11px] uppercase tracking-widest text-[#4A5568]">
            PREFERENCES
          </Text>
          <View className="gap-3">
            <SettingsRow
              icon={Sun}
              label="Light mode"
              trailing={
                <Switch
                  value={lightMode}
                  onValueChange={setLightMode}
                  trackColor={{ false: '#2D3A4F', true: '#6B8DD6' }}
                  thumbColor="#ffffff"
                />
              }
              onPress={() => setLightMode((v) => !v)}
            />
            <SettingsRow
              icon={Moon}
              label="Voice assistance"
              trailing={
                <Switch
                  value={voiceAssistance}
                  onValueChange={setVoiceAssistance}
                  trackColor={{ false: '#2D3A4F', true: '#6B8DD6' }}
                  thumbColor="#ffffff"
                />
              }
              onPress={() => setVoiceAssistance((v) => !v)}
            />
          </View>
        </View>

        {/* Danger Zone Section */}
        <View className="mb-8">
          <Text className="font-lato-bold mb-4 text-[11px] uppercase tracking-widest text-[#4A5568]">
            DANGER ZONE
          </Text>
          <View className="gap-3">
            <SettingsRow
              icon={Trash2}
              label="Delete account"
              iconColor="#d4183d"
              iconBg="#d4183d33"
              labelColor="text-[#d4183d]"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
