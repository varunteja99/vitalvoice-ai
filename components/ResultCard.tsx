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
  
  // Format title: neurological -> Neurological
  const formattedTitle = title.charAt(0).toUpperCase() + title.slice(1).replace('_', ' ');

  return (
    <div 
      className="surface-container rounded-[24px] p-5 opacity-0 animate-fade-in-up hover:bg-[#323335] transition-colors"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-[16px] font-medium text-gray-200">{formattedTitle}</h3>
          <span className={`inline-flex items-center px-2 py-1 mt-1 rounded-md text-[11px] font-medium ${getStatusColor(data.concern_level)}`}>
            {data.concern_level.toUpperCase()}
          </span>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-white">{data.score}</span>
          <span className="text-xs text-gray-400 block">/100</span>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full bg-[#444746] h-1.5 rounded-full mb-4 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ${getBarColor(data.score)}`}
          style={{ width: `${data.score}%` }}
        />
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