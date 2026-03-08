import * as React from 'react';
import { View } from 'react-native';

const STAR_COUNT = 30;

function generateStars() {
  return Array.from({ length: STAR_COUNT }, (_, i) => {
    const row = Math.floor(i / 6);
    const col = i % 6;
    const top = 5 + row * 18 + (Math.random() - 0.5) * 10;
    const left = 10 + col * 15 + (Math.random() - 0.5) * 8;
    const opacity = 0.2 + Math.random() * 0.4;
    return { top, left, opacity };
  });
}

const stars = generateStars();

export function StarBackground() {
  return (
    <View className="absolute inset-0 overflow-hidden">
      {stars.map((star, i) => (
        <View
          key={i}
          className="absolute h-[2px] w-[2px] rounded-full bg-white"
          style={{
            top: `${star.top}%`,
            left: `${star.left}%`,
            opacity: star.opacity,
          }}
        />
      ))}
    </View>
  );
}
