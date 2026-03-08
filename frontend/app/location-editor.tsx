import { BottomNav } from '@/components/BottomNav';
import { StarBackground } from '@/components/StarBackground';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { router } from 'expo-router';
import { ArrowLeft, Building, Calendar, Search } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
console.log('[DEBUG] API_URL:', API_URL);

type ListItem = {
  name: string;
  subtitle: string;
  club?: string;
  date?: string;
  time?: string;
};

type AutocompleteResult = string;

function useApi<T>(url: string | null): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    console.log('[DEBUG] Fetching:', url);
    fetch(url)
      .then((res) => {
        console.log('[DEBUG] Response status:', res.status, 'url:', url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        console.log('[DEBUG] Response data from', url, ':', JSON.stringify(json));
        if (!cancelled) setData(json);
      })
      .catch((err: Error) => {
        console.error('[DEBUG] Fetch error for', url, ':', err.message);
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading, error };
}

export default function LocationEditorScreen() {
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [token, setToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem('token').then(setToken);
  }, []);

  // Debounce search query by 300ms
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 100);
    return () => clearTimeout(timer);
  }, [query]);

  const autocompleteUrl =
    debouncedQuery.trim().length > 0
      ? `${API_URL}/autocomplete?q=${encodeURIComponent(debouncedQuery)}`
      : null;

  const { data: suggestions, loading: suggestionsLoading } =
    useApi<AutocompleteResult[]>(autocompleteUrl);

const { data: historyData, loading: historyLoading } = useApi<ListItem[]>(
  token ? `${API_URL}/history` : null
);

  const { data: eventsData, loading: eventsLoading } = useApi<ListItem[]>(`${API_URL}/events`);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setShowSuggestions(text.trim().length > 0);
  };

  const handleSuggestionPress = (item: AutocompleteResult) => {
    setQuery(item);
    setShowSuggestions(false);
    router.push({ pathname: '/ar', params: { destination: item } });
  };

  return (
    <View className="flex-1 bg-[#0A0E1A]">
      <StarBackground />

      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        className="absolute left-5 top-14 z-20 h-10 w-10 items-center justify-center rounded-full border border-[#2D3A4F80] bg-[#1A233299]">
        <Icon as={ArrowLeft} size={18} className="text-[#6B8DD6]" />
      </Pressable>

      {/* Header */}
      <View className="z-10 pb-4 pl-20 pt-14">
        <Text className="font-instrument mb-3 text-[32px] text-white">Where are you headed today?</Text>
      </View>
      {/* Search bar + dropdown */}
      <View className="-pt-5 relative z-30 px-4 pb-3">
        <View className="flex-row items-center gap-3 rounded-xl border border-[#2D3A4F80] bg-[#1A233280] px-4 py-3.5">
          <Icon as={Search} size={20} className="text-[#4A5568]" />
          <TextInput
            placeholder="Enter destination or room code"
            placeholderTextColor="#4A5568"
            value={query}
            onChangeText={handleQueryChange}
            onFocus={() => setShowSuggestions(query.trim().length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            returnKeyType="search"
            className="flex-1 text-[15px] text-white"
          />
          {suggestionsLoading && <ActivityIndicator size="small" color="#6B8DD6" />}
        </View>

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions && suggestions.length > 0 && (
          <View className="absolute left-0 right-0 top-full z-40 mx-4 mt-1 overflow-hidden rounded-xl border border-[#2D3A4F80] bg-[#1A2332]">
            {suggestions.map((item, index) => (
              <Pressable
                key={index}
                onPress={() => handleSuggestionPress(item)}
                className="flex-row items-center gap-3 px-4 py-3"
                style={
                  index < suggestions.length - 1
                    ? { borderBottomWidth: 1, borderBottomColor: '#2D3A4F40' }
                    : undefined
                }>
                <Icon as={Search} size={16} className="text-[#4A5568]" />
                <Text className="font-lato flex-1 text-[14px] text-white">{item}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Scrollable content */}
      <ScrollView className="z-10 flex-1 px-6" contentContainerStyle={{ paddingBottom: 96 }}>
        {/* Recent section */}
        <View className="mb-8">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-lato-bold text-[11px] uppercase tracking-widest text-[#6B7885]">
              RECENT
            </Text>
            <Pressable>
              <Text className="font-lato text-[13px] text-[#6B8DD6]">Clear all</Text>
            </Pressable>
          </View>

          {historyLoading ? (
            <ActivityIndicator color="#6B8DD6" />
          ) : historyData && historyData.length > 0 ? (
            <View className="gap-3">
              {historyData.map((item, index) => (
                <Pressable
                  key={index}
                  onPress={() => router.push({ pathname: '/ar', params: { destination: item.name } })}
                  className="flex-row items-center gap-4 rounded-2xl border border-[#2D3A4F66] bg-[#1A233266] px-4 py-4">
                  <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#6B8DD633]">
                    <Icon as={Building} size={20} className="text-[#6B8DD6]" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-lato-bold mb-0.5 text-[15px] text-white">{item.name}</Text>
                    <Text className="text-[13px] text-[#6B7885]">{item.subtitle}</Text>
                  </View>
                  {(item.date || item.time) && (
                    <View className="items-end">
                      {item.date && <Text className="text-xs text-[#6B7885]">{item.date}</Text>}
                      {item.time && <Text className="text-xs text-[#6B7885]">{item.time}</Text>}
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          ) : (
            <Text className="text-[13px] text-[#4A5568]">No recent destinations</Text>
          )}
        </View>

        {/* Upcoming Events section */}
        <View className="mb-8">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-lato-bold text-[11px] uppercase tracking-widest text-[#6B7885]">
              UPCOMING EVENTS
            </Text>
            <Pressable>
              <Text className="font-lato text-[13px] text-[#6B8DD6]">See all</Text>
            </Pressable>
          </View>

          {eventsLoading ? (
            <ActivityIndicator color="#6B8DD6" />
          ) : eventsData && eventsData.length > 0 ? (
            <View className="gap-3">
              {eventsData.map((item, index) => (
                <Pressable
                  key={index}
                  onPress={() => router.push({ pathname: '/ar', params: { destination: item.name } })}
                  className="flex-row items-center gap-4 rounded-2xl border border-[#2D3A4F66] bg-[#1A233266] px-4 py-4">
                  <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#A474D433]">
                    <Icon as={Calendar} size={20} className="text-[#A474D4]" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-lato-bold mb-0.5 text-[15px] text-white">{item.subtitle}</Text>
                    {item.club ? (
                      <Text className="text-[13px] text-[#A474D4]">{item.club}</Text>
                    ) : null}
                    <Text className="text-[12px] text-[#6B7885]">{item.name}</Text>
                  </View>
                  {item.time && (
                    <View className="items-end">
                      <Text className="text-xs text-[#6B7885]">{item.time}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          ) : (
            <Text className="text-[13px] text-[#4A5568]">No upcoming events</Text>
          )}
        </View>
      </ScrollView>

      <BottomNav activeTab="home" />
    </View>
  );
}
