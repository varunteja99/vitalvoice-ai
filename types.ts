export interface HealthDomain {
  score: number;
  concern_level: 'low' | 'moderate' | 'elevated' | 'high';
  indicators: string[];
  explanation: string;
}

export interface KeyObservation {
  finding: string;
  significance: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface Recommendation {
  action: string;
  urgency: 'routine' | 'soon' | 'prompt';
  reason: string;
}

export interface HealthTrends {
  improving: string[];
  stable: string[];
  needs_attention: string[];
}

export interface HealthAnalysis {
  overall_wellness_score: number;
  confidence_level: 'low' | 'medium' | 'high';
  domain_scores: {
    neurological: HealthDomain;
    mental_health: HealthDomain;
    respiratory: HealthDomain;
    cardiovascular: HealthDomain;
    metabolic: HealthDomain;
    hydration: HealthDomain;
  };
  key_observations: KeyObservation[];
  recommendations: Recommendation[];
  trends: HealthTrends;
  summary: string;
  disclaimer: string;
}

export enum AppScreen {
  INTRO = 'INTRO',
  RECORDING = 'RECORDING',
  FACE_PROMPT = 'FACE_PROMPT',
  FACE_CAPTURE = 'FACE_CAPTURE',
  UPLOAD_CONFIG = 'UPLOAD_CONFIG',
  ANALYZING = 'ANALYZING',
  RESULTS = 'RESULTS',
  CHAT = 'CHAT'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isAudio?: boolean;
  audioUrl?: string;
}