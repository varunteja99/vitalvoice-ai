import React from 'react';
import { HealthDomain } from '../types';

interface ResultCardProps {
  title: string;
  data: HealthDomain;
  delay: number;
}

const ResultCard: React.FC<ResultCardProps> = ({ title, data, delay }) => {
  const getStatusColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-emerald-300 bg-emerald-900/30';
      case 'moderate': return 'text-yellow-300 bg-yellow-900/30';
      case 'elevated': return 'text-orange-300 bg-orange-900/30';
      case 'high': return 'text-red-300 bg-red-900/30';
      default: return 'text-gray-300 bg-gray-800';
    }
  };

  const getBarColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-400';
    if (score >= 60) return 'bg-yellow-400';
    if (score >= 40) return 'bg-orange-400';
    return 'bg-red-400';
  };

  const getIcon = (title: string) => {
    switch (title.toLowerCase()) {
      case 'neurological': return 'psychology'; // Brain/Mind
      case 'mental_health': return 'mood'; // Face/Mood
      case 'respiratory': return 'air'; // Breath/Air
      case 'cardiovascular': return 'monitor_heart'; // Heart rate monitor
      case 'metabolic': return 'bolt'; // Energy/Power
      case 'hydration': return 'water_drop'; // Water
      default: return 'health_and_safety';
    }
  };
  
  // Format title: neurological -> Neurological
  const formattedTitle = title.charAt(0).toUpperCase() + title.slice(1).replace('_', ' ');

  // Mock population average (randomized slightly for realism between 70-85)
  const populationAvg = 75 + (title.length % 10); 

  return (
    <div 
      className="surface-container rounded-[24px] p-5 opacity-0 animate-fade-in-up hover:bg-[#323335] transition-colors relative group"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1E1F20] border border-[#444746] flex items-center justify-center shrink-0">
             <span className="material-symbol text-[#A8C7FA] text-[20px]">{getIcon(title)}</span>
          </div>
          <div>
            <h3 className="text-[16px] font-medium text-gray-200 leading-tight">{formattedTitle}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 mt-1.5 rounded-md text-[10px] font-bold tracking-wide uppercase ${getStatusColor(data.concern_level)}`}>
              {data.concern_level}
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-white">{data.score}</span>
          <span className="text-xs text-gray-400 block">/100</span>
        </div>
      </div>
      
      {/* Progress Bar Container */}
      <div className="relative w-full h-6 mb-2">
        {/* Track */}
        <div className="absolute top-2 w-full bg-[#444746] h-1.5 rounded-full overflow-hidden">
             <div 
            className={`h-full rounded-full transition-all duration-1000 ${getBarColor(data.score)}`}
            style={{ width: `${data.score}%` }}
            />
        </div>
        
        {/* Population Average Marker */}
        <div 
            className="absolute top-1 w-0.5 h-3.5 bg-white/50 z-10"
            style={{ left: `${populationAvg}%` }}
        >
            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black/80 text-[10px] text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                Avg: {populationAvg}
            </div>
        </div>
      </div>
      
      <div className="flex justify-between text-[10px] text-gray-500 mb-3">
          <span>0</span>
          <span>Population Avg</span>
          <span>100</span>
      </div>

      <p className="text-[#C4C7C5] text-sm leading-relaxed mb-4">{data.explanation}</p>
      
      <div className="flex flex-wrap gap-2">
        {data.indicators.map((indicator, idx) => (
          <span key={idx} className="text-[11px] bg-[#1E1F20] border border-[#444746] text-gray-300 px-2.5 py-1 rounded-full">
            {indicator}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ResultCard;
