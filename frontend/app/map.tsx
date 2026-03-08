import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import * as React from 'react';
import { Image, type ImageStyle, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const BG_IMAGE_STYLE: ImageStyle = {
  width: '100%',
  height: '100%',
};

function CornerBracket({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const paths: Record<string, string> = {
    tl: 'M2 12V2H12',
    tr: 'M46 12V2H36',
    bl: 'M2 36V46H12',
    br: 'M46 36V46H36',
  };
  const posClass: Record<string, string> = {
    tl: 'absolute top-0 left-0',
    tr: 'absolute top-0 right-0',
    bl: 'absolute bottom-0 left-0',
    br: 'absolute bottom-0 right-0',
  };

  return (
    <View className={`${posClass[position]} h-12 w-12`}>
      <Svg width={48} height={48} viewBox="0 0 48 48" fill="none">
        <Path d={paths[position]} stroke="#6B8DD6" strokeWidth={3} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

export default function MapScreen() {
  return (
    <View className="flex-1 bg-[#0A0E1A]">
      {/* AR Camera View / Background */}
      <View className="absolute inset-0">
        <Image
          source={{
            uri: 'https://images.unsplash.com/photo-1771147372634-976f022c0033?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
          }}
          style={BG_IMAGE_STYLE}
          resizeMode="cover"
        />
      </View>

      {/* Top Bar */}
      <View className="absolute left-0 right-0 top-0 z-30 flex-row items-center justify-between px-4 pb-4 pt-14">
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          className="h-12 w-12 items-center justify-center rounded-full border border-[#2D3A4F80] bg-[#1A2332CC]"
        >
          <Icon as={ArrowLeft} size={20} className="text-white" />
        </Pressable>

        {/* AR Navigate label */}
        <View className="rounded-full border border-[#2D3A4F80] bg-[#1A2332CC] px-6 py-2">
          <Text className="font-lato-bold text-[13px] tracking-wider text-white">
            AR NAVIGATE
          </Text>
        </View>

        {/* Profile button */}
        <View className="items-center">
          <Pressable
            onPress={() => router.push('/profile')}
            className="h-12 w-12 items-center justify-center rounded-full border border-[#8B7EC880] bg-[#6B8DD6CC]"
          >
            <Text className="font-lato-bold text-base text-white">JD</Text>
          </Pressable>
          <Text className="mt-1 text-[10px] text-white/80">Settings</Text>
        </View>
      </View>

      {/* AR Corner Brackets */}
      <View className="pointer-events-none absolute bottom-1/2 left-6 right-6 top-1/4 z-10">
        <CornerBracket position="tl" />
        <CornerBracket position="tr" />
        <CornerBracket position="bl" />
        <CornerBracket position="br" />
      </View>

      {/* Floating Navigation Instruction */}
      <View className="absolute bottom-44 left-0 right-0 z-20 items-center">
        <View className="flex-row items-center gap-2 rounded-full bg-[#6B8DD6E6] px-6 py-3">
          <View className="h-2 w-2 rounded-full bg-white" />
          <Text className="font-lato-bold text-sm tracking-wide text-white">
            TURN LEFT IN 250 FT
          </Text>
        </View>
      </View>

      {/* Bottom Sheet */}
      <View className="absolute bottom-0 left-0 right-0 z-30 rounded-t-3xl border-t border-[#2D3A4F80] bg-[#0A0E1AF2] px-6 py-6">
        {/* Destination Header */}
        <View className="mb-6 flex-row items-center justify-between">
          <Text className="font-instrument text-[28px] text-white">ECSW 1.315</Text>
          <View className="rounded-full border border-[#6B8DD666] bg-[#6B8DD633] px-3 py-1.5">
            <Text className="font-lato-bold text-[13px] text-[#6B8DD6]">
              ~2 min
            </Text>
          </View>
        </View>

        {/* Direction Cards */}
        <View className="gap-3">
          {/* Turn Left Card */}
          <Pressable className="flex-row items-center gap-4 rounded-2xl border border-[#2D3A4F80] bg-[#1A233299] px-5 py-4">
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#6B8DD633]">
              <Icon as={ArrowLeft} size={20} className="text-[#6B8DD6]" />
            </View>
            <View className="flex-1">
              <Text className="font-lato-bold mb-1 text-base text-white">
                Turn Left
              </Text>
              <Text className="text-[13px] text-[#6B7885]">
                Proceed 250 ft down the hall
              </Text>
            </View>
          </Pressable>

          {/* Turn Right Card */}
          <Pressable className="flex-row items-center gap-4 rounded-2xl border border-[#2D3A4F80] bg-[#1A233299] px-5 py-4">
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#6B8DD633]">
              <Icon as={ArrowRight} size={20} className="text-[#6B8DD6]" />
            </View>
            <View className="flex-1">
              <Text className="font-lato-bold mb-1 text-base text-white">
                Turn Right
              </Text>
              <Text className="text-[13px] text-[#6B7885]">
                Proceed 100 ft to destination
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
