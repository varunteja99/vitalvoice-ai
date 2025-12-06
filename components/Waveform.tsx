import React, { useEffect, useState } from 'react';

interface WaveformProps {
  isRecording: boolean;
}

const Waveform: React.FC<WaveformProps> = ({ isRecording }) => {
  const [bars, setBars] = useState<number[]>(new Array(24).fill(10));

  useEffect(() => {
    if (!isRecording) {
      setBars(new Array(24).fill(10));
      return;
    }

    const interval = setInterval(() => {
      setBars(prev => prev.map(() => Math.max(10, Math.floor(Math.random() * 80) + 10)));
    }, 80);

    return () => clearInterval(interval);
  }, [isRecording]);

  return (
    <div className="flex items-center justify-center gap-[3px] h-24 w-full">
      {bars.map((height, i) => (
        <div
          key={i}
          className="w-1.5 rounded-full transition-all duration-150 ease-out"
          style={{ 
            height: `${height}%`, 
            backgroundColor: i % 2 === 0 ? '#4285F4' : '#9B72CB', // Blue and Purple (Gemini colors)
            opacity: isRecording ? 1 : 0.3
          }}
        />
      ))}
    </div>
  );
};

export default Waveform;