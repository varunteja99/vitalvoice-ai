import React, { useEffect, useState } from 'react';

interface WaveformProps {
  isRecording: boolean;
  audioLevel?: number; // 0 to 1 normalized
  quality?: 'good' | 'low' | 'silent' | 'idle';
}

const Waveform: React.FC<WaveformProps> = ({ isRecording, audioLevel = 0, quality = 'idle' }) => {
  const [bars, setBars] = useState<number[]>(new Array(24).fill(10));

  useEffect(() => {
    if (!isRecording) {
      setBars(new Array(24).fill(10));
      return;
    }

    const interval = setInterval(() => {
      setBars(prev => prev.map(() => {
        // Base height calculation:
        // If audioLevel is provided, use it to scale bar height.
        // Add randomness for "alive" feel even with steady input.
        const baseHeight = 10 + (audioLevel * 80); 
        const randomOffset = Math.random() * 20 - 10;
        return Math.min(100, Math.max(10, baseHeight + randomOffset));
      }));
    }, 50);

    return () => clearInterval(interval);
  }, [isRecording, audioLevel]);

  const getBarColor = (index: number) => {
    if (!isRecording) return index % 2 === 0 ? '#4285F4' : '#9B72CB';

    switch (quality) {
      case 'good': return '#34D399'; // Emerald 400
      case 'low': return '#FACC15'; // Yellow 400
      case 'silent': return '#EF4444'; // Red 500
      default: return index % 2 === 0 ? '#4285F4' : '#9B72CB';
    }
  };

  return (
    <div className="flex items-center justify-center gap-[3px] h-24 w-full transition-all duration-300">
      {bars.map((height, i) => (
        <div
          key={i}
          className="w-1.5 rounded-full transition-all duration-100 ease-out"
          style={{ 
            height: `${height}%`, 
            backgroundColor: getBarColor(i),
            opacity: isRecording ? 1 : 0.3,
            boxShadow: isRecording && quality === 'good' ? '0 0 4px rgba(52, 211, 153, 0.5)' : 'none'
          }}
        />
      ))}
    </div>
  );
};

export default Waveform;