import { StarBackground } from '@/components/StarBackground';
import { Text } from '@/components/ui/text';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as React from 'react';
import { Image, type ImageStyle, Pressable, View } from 'react-native';

const LOGO = require('@/assets/images/astrolabe-logo.png');

const LOGO_STYLE: ImageStyle = {
  width: 80,
  height: 80,
};

export default function LandingScreen() {
  return (
    <View className="flex-1 items-center justify-between bg-[#0A0E1A] px-8 py-12">
      <StarBackground />

      {/* Top spacer */}
      <View className="flex-1" />

      {/* Logo and Title */}
      <View className="z-10 items-center gap-6">
        {/* Logo with circular glow */}
        <View className="h-32 w-32 items-center justify-center">
          <View className="absolute inset-0 rounded-full border-2 border-[#5B7FA866]" />
          <Image source={LOGO} style={LOGO_STYLE} resizeMode="contain" />
        </View>

        <Text className="text-5xl font-bold tracking-tight text-white">
          Astrolabe
        </Text>

        <Text className="max-w-[240px] text-center text-[15px] leading-relaxed text-[#6B7885]">
          Navigate your world{'\n'}with celestial precision
        </Text>

        {/* Get started button */}
        <Pressable
          onPress={() => router.push('/auth')}
          className="mt-4 w-full max-w-[360px] overflow-hidden rounded-2xl"
        >
          <LinearGradient
            colors={['#6B8DD6', '#8B7EC8', '#A474D4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="items-center px-8 py-4"
          >
            <Text className="text-base font-semibold text-white">
              Get started
            </Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* Bottom spacer */}
      <View className="flex-1" />

      {/* Footer links */}
      <View className="z-10 w-full items-center gap-6">
        <View className="flex-row gap-8">
          <Pressable>
            <Text className="text-[13px] text-[#4A5568]">Help</Text>
          </Pressable>
          <Pressable>
            <Text className="text-[13px] text-[#4A5568]">Contact us</Text>
          </Pressable>
          <Pressable>
            <Text className="text-[13px] text-[#4A5568]">Privacy</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
