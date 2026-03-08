import { StarBackground } from '@/components/StarBackground';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Lock, Mail } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, Pressable, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export default function AuthScreen() {
  //I LOVE COMMITING SECRETS TO GITHUB
  const [email, setEmail] = React.useState('tharunsevvel@gmail.com');
  const [password, setPassword] = React.useState('123');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Error', data.detail ?? 'Login failed.');
        return;
      }

      await AsyncStorage.setItem('token', data.token);
      router.push('/location-editor');
    } catch (err) {
      Alert.alert('Network error', 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-[#0A0E1A] px-8">
      <StarBackground />

      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        className="absolute left-5 top-14 z-20 h-10 w-10 items-center justify-center rounded-full border border-[#2D3A4F80] bg-[#1A233299]">
        <Icon as={ArrowLeft} size={18} className="text-[#6B8DD6]" />
      </Pressable>

      {/* Centered content */}
      <View className="z-10 w-full max-w-[360px] items-center">
        {/* Title */}
        <Text className="mb-12 font-instrument text-[80px] text-white">Astrolabe</Text>

        {/* Welcome text */}
        <View className="mb-10 items-center">
          <Text className="mb-3 font-instrument text-2xl text-white">Welcome Back</Text>
          <Text className="text-sm text-[#6B7885]">Sign in to continue your journey</Text>
        </View>

        {/* Email input */}
        <View className="mb-5 w-full flex-row items-center gap-3 rounded-xl border border-[#2D3A4F80] bg-[#1A233280] px-5 py-4">
          <Icon as={Mail} size={18} className="text-[#4A5568]" />
          <TextInput
            placeholder="Email"
            placeholderTextColor="#4A5568"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            className="flex-1 text-[15px] text-white"
          />
        </View>

        {/* Password input */}
        <View className="mb-5 w-full flex-row items-center gap-3 rounded-xl border border-[#2D3A4F80] bg-[#1A233280] px-5 py-4">
          <Icon as={Lock} size={18} className="text-[#4A5568]" />
          <TextInput
            placeholder="Password"
            placeholderTextColor="#4A5568"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            className="flex-1 text-[15px] text-white"
          />
        </View>

        {/* Submit button */}
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          className="mt-4 w-full overflow-hidden rounded-xl">
          <LinearGradient
            colors={['#6B8DD6', '#8B7EC8', '#A474D4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="items-center px-8 py-4">
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="font-lato-bold text-base text-white">Log in / Sign Up</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
