import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AppScreen, HealthAnalysis, ChatMessage } from './types';
import { analyzeHealth, chatWithHealthAssistant } from './services/geminiService';
import { generatePDF } from './services/pdfService';
import Waveform from './components/Waveform';
import ResultCard from './components/ResultCard';

// --- Sample Data for Demo ---
const SAMPLE_ANALYSIS_RESULT: HealthAnalysis = {
  overall_wellness_score: 82,
  confidence_level: 'high',
  summary: "The analysis indicates a robust vocal profile with strong respiratory support and clear articulation. Neurological markers are stable with no signs of tremors or dysarthria. Mental health indicators suggest a positive and engaged emotional state.",
  disclaimer: "This is a demonstration result based on clinical sample data. Not a medical diagnosis.",
  domain_scores: {
    neurological: { score: 88, concern_level: 'low', indicators: ['Stable pitch', 'No micro-tremors', 'Regular rate'], explanation: 'High vocal stability suggests excellent neuromotor control.' },
    mental_health: { score: 78, concern_level: 'low', indicators: ['High energy', 'Varied intonation'], explanation: 'Speech patterns indicate positive emotional engagement and low stress.' },
    respiratory: { score: 92, concern_level: 'low', indicators: ['Sustained phonation', 'Clear breath'], explanation: 'Excellent respiratory capacity detected with no audible gasping.' },
    cardiovascular: { score: 81, concern_level: 'low', indicators: ['Regular rhythm'], explanation: 'No arrhythmic patterns observed in speech breathing cycles.' },
    metabolic: { score: 72, concern_level: 'moderate', indicators: ['Slight fatigue markers'], explanation: 'Minor signs of vocal fatigue detected, possibly hydration-related.' },
    hydration: { score: 85, concern_level: 'low', indicators: ['Clear tone', 'Low jitter'], explanation: 'Vocal folds appear well-hydrated based on acoustic clarity.' },
  },
  key_observations: [
    { finding: "High vocal stability (Jitter < 0.5%)", significance: "Indicates healthy neuromotor function", confidence: "high" },
    { finding: "Consistent speech rate (140 wpm)", significance: "Normal cognitive processing speed", confidence: "high" },
    { finding: "Harmonic-to-Noise Ratio > 20dB", significance: "Clear, efficient phonation", confidence: "high" }
  ],
  recommendations: [
    { action: "Maintain current hydration", urgency: "routine", reason: "Supports optimal vocal fold mucosal wave" },
    { action: "Monitor fatigue levels", urgency: "soon", reason: "Slight metabolic strain detected in lower registers" }
  ],
  trends: {
    improving: ["Respiratory support", "Pitch range"],
    stable: ["Neurological markers", "Cardiovascular health"],
    needs_attention: []
  }
};

// --- Components ---

// Simple Markdown Renderer
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const processText = (text: string) => {
    return text.split('\n').map((line, lineIndex) => {
      if (line.startsWith('## ')) return <h3 key={lineIndex} className="text-lg font-bold text-[#A8C7FA] mt-4 mb-2">{line.replace('## ', '')}</h3>;
      if (line.startsWith('### ')) return <h4 key={lineIndex} className="text-base font-bold text-[#D3E3FD] mt-3 mb-1">{line.replace('### ', '')}</h4>;
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const itemContent = line.trim().substring(2);
        return (
          <div key={lineIndex} className="flex items-start gap-2 mb-1 ml-2">
             <span className="text-[#A8C7FA] mt-1.5">•</span>
             <p className="flex-1 text-[#E3E3E3] leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInlineStyles(itemContent) }} />
          </div>
        );
      }
      if (line.trim() === '') return <div key={lineIndex} className="h-2"></div>;
      return <p key={lineIndex} className="mb-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInlineStyles(line) }} />;
    });
  };

  const formatInlineStyles = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-gray-300">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-[#2E2F30] px-1 rounded text-sm font-mono text-[#E8DEF8]">$1</code>');
  };

  return <div className="markdown-content">{processText(content)}</div>;
};

// Tech Specs Modal
const TechModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-[#1E1F20] w-full max-w-2xl rounded-[24px] border border-[#444746] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[#444746] flex justify-between items-center">
                <h2 className="text-2xl font-normal text-white flex items-center gap-2">
                    <span className="material-symbol text-[#A8C7FA]">code</span>
                    Technical Architecture
                </h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <span className="material-symbol">close</span>
                </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
                <div>
                    <h3 className="text-[#A8C7FA] font-bold uppercase text-xs tracking-wider mb-2">AI Models Used</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-[#131314] p-4 rounded-xl border border-[#444746]">
                            <div className="font-bold text-white mb-1">Gemini 2.5 Flash</div>
                            <div className="text-sm text-gray-400">Low-latency multimodal analysis of audio (PCM) and video frames.</div>
                        </div>
                        <div className="bg-[#131314] p-4 rounded-xl border border-[#444746]">
                            <div className="font-bold text-white mb-1">Gemini 3 Pro (Preview)</div>
                            <div className="text-sm text-gray-400">Complex reasoning for clinical correlation and trend analysis.</div>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-[#A8C7FA] font-bold uppercase text-xs tracking-wider mb-2">Data Pipeline</h3>
                    <div className="flex flex-col gap-2">
                         <div className="flex items-center gap-3 text-sm text-gray-300">
                            <span className="material-symbol text-emerald-400">mic</span>
                            <span>Raw Audio (WebM/PCM) Capture</span>
                         </div>
                         <div className="h-4 border-l border-dashed border-gray-600 ml-3"></div>
                         <div className="flex items-center gap-3 text-sm text-gray-300">
                             <span className="material-symbol text-purple-400">transform</span>
                             <span>Client-side Base64 Encoding</span>
                         </div>
                         <div className="h-4 border-l border-dashed border-gray-600 ml-3"></div>
                         <div className="flex items-center gap-3 text-sm text-gray-300">
                             <span className="material-symbol text-blue-400">cloud</span>
                             <span>Gemini API Multimodal Request</span>
                         </div>
                         <div className="h-4 border-l border-dashed border-gray-600 ml-3"></div>
                         <div className="flex items-center gap-3 text-sm text-gray-300">
                             <span className="material-symbol text-orange-400">data_object</span>
                             <span>Structured JSON Response</span>
                         </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-[#A8C7FA] font-bold uppercase text-xs tracking-wider mb-2">Sample API Request</h3>
                    <pre className="bg-[#131314] p-4 rounded-xl border border-[#444746] text-xs text-gray-300 font-mono overflow-x-auto">
{`const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: {
    parts: [
      { text: "Analyze for vocal biomarkers..." },
      { inlineData: { mimeType: "audio/webm", data: audioB64 } }
    ]
  },
  config: { responseSchema: HEALTH_SCHEMA }
});`}
                    </pre>
                </div>
            </div>
            <div className="p-6 border-t border-[#444746] bg-[#262728] rounded-b-[24px]">
                 <p className="text-xs text-center text-gray-500">Based on research papers regarding acoustic analysis of vocal biomarkers in neurology.</p>
            </div>
        </div>
    </div>
);

// High-End Cinematic Demo Modal (Apple-style Ad Simulator)
const CinematicDemoModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    
    // 15 Seconds Duration (15,000 ms) - TIGHT EDIT
    const DURATION = 15000; 

    useEffect(() => {
        let animationFrameId: number;
        let lastTimestamp: number;

        const loop = (timestamp: number) => {
            if (!lastTimestamp) lastTimestamp = timestamp;
            const delta = timestamp - lastTimestamp;
            
            if (isPlaying) {
                setCurrentTime(prev => {
                    const next = prev + delta;
                    if (next >= DURATION) {
                        return DURATION; // Stop at end
                    }
                    return next;
                });
            }
            lastTimestamp = timestamp;
            animationFrameId = requestAnimationFrame(loop);
        };

        if (isPlaying && currentTime < DURATION) {
            animationFrameId = requestAnimationFrame(loop);
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [isPlaying, currentTime]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const restart = () => {
        setCurrentTime(0);
        setIsPlaying(true);
    };

    // Helper to check precise time ranges
    const isBetween = (startS: number, endS: number) => {
        const ms = currentTime;
        return ms >= startS * 1000 && ms < endS * 1000;
    };

    // Helper for Narration Text (Subtitle) - Compressed for 15s
    const getNarration = () => {
        const ms = currentTime;
        // Act 1 (0-2.5s)
        if (ms < 2500) return "Millions discover health issues too late.";
        // Act 2 (2.5-5s)
        if (ms < 5000) return "VitalVoice AI detects hidden biomarkers instantly.";
        // Act 3 (5-11s)
        if (ms < 8000) return "Just record your voice for 30 seconds.";
        if (ms < 11000) return "Gemini analyzes tremor, pitch, and rhythm.";
        // Act 4 (11-13s)
        if (ms < 13000) return "Powered by Gemini 3 Pro multimodal intelligence.";
        // Act 5 (13-15s)
        if (ms < 15000) return "Accessible healthcare for everyone.";
        return "";
    }

    return (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center font-sans overflow-hidden">
            {/* Cinematic Container */}
            <div className="relative w-full h-full max-w-[100vw] max-h-[100vh] flex flex-col items-center justify-center">
                
                {/* ================= ACT 1: THE PROBLEM (0s - 2.5s) ================= */}
                {isBetween(0, 2.5) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center animate-fade-in-up px-6 bg-black">
                         <div className="animate-fade-in-up">
                             <h1 className="text-6xl font-bold text-white tracking-tighter mb-2">Too Late?</h1>
                             <p className="text-xl text-red-400 font-medium">Early Detection Matters</p>
                         </div>
                    </div>
                )}


                {/* ================= ACT 2: THE SOLUTION (2.5s - 5s) ================= */}
                {isBetween(2.5, 5) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in-up bg-[#050505]">
                         <div className="text-center animate-fade-in-up">
                             <span className="material-symbol text-8xl text-transparent bg-clip-text bg-gradient-to-tr from-[#4285F4] to-[#9B72CB] transform scale-125 animate-pulse mb-4">graphic_eq</span>
                             <h1 className="text-4xl font-semibold text-white tracking-tight">VitalVoice AI</h1>
                         </div>
                    </div>
                )}


                {/* ================= ACT 3: THE DEMO (Phone Sim) (5s - 11s) ================= */}
                {isBetween(5, 11) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
                        {/* Phone Frame */}
                        <div className="relative w-[300px] h-[600px] md:w-[375px] md:h-[750px] bg-black rounded-[48px] border-[8px] border-[#333] shadow-2xl overflow-hidden transform transition-all duration-500 scale-90 md:scale-100">
                             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-2xl z-30"></div>
                             
                             <div className="w-full h-full bg-[#131314] relative flex flex-col">
                                
                                {/* 5-7.5s: RECORDING */}
                                {isBetween(5, 7.5) && (
                                    <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in-up">
                                        <div className="text-sm text-[#A8C7FA] uppercase font-bold mb-8 tracking-widest">Listening...</div>
                                        <div className="w-full h-32 mb-8"><Waveform isRecording={true} /></div>
                                    </div>
                                )}

                                {/* 7.5-9s: PROCESSING */}
                                {isBetween(7.5, 9) && (
                                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in-up">
                                         <div className="relative w-32 h-32 mb-8">
                                             <svg className="animate-spin w-full h-full text-[#A8C7FA]" viewBox="0 0 24 24">
                                                 <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="30 60" />
                                             </svg>
                                             <div className="absolute inset-0 flex items-center justify-center">
                                                 <span className="material-symbol text-4xl text-white">neurology</span>
                                             </div>
                                         </div>
                                         <div className="text-[#A8C7FA] text-sm font-mono">Analyzing...</div>
                                    </div>
                                )}

                                {/* 9-11s: RESULTS */}
                                {isBetween(9, 11) && (
                                    <div className="flex-1 bg-[#131314] p-6 animate-fade-in-up overflow-hidden relative">
                                        <div className="flex justify-between items-center mb-6">
                                            <h2 className="text-xl font-bold text-white">Insights</h2>
                                            <div className="bg-[#1E1F20] px-3 py-1 rounded-full text-xs text-gray-400">Today</div>
                                        </div>
                                        <div className="bg-[#1E1F20] rounded-3xl p-6 mb-4 border border-[#333] flex items-center justify-between">
                                            <div>
                                                <div className="text-5xl font-bold text-white">88</div>
                                                <div className="text-xs text-[#A8C7FA] uppercase tracking-wider mt-1">Wellness Score</div>
                                            </div>
                                            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center">
                                                <span className="material-symbol text-emerald-400">check</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-[#1E1F20] p-4 rounded-2xl border border-[#333]">
                                                <span className="material-symbol text-[#A8C7FA] mb-2">neurology</span>
                                                <div className="text-sm text-white font-medium">Neuro</div>
                                                <div className="text-xs text-emerald-400">Stable</div>
                                            </div>
                                            <div className="bg-[#1E1F20] p-4 rounded-2xl border border-[#333]">
                                                <span className="material-symbol text-[#A8C7FA] mb-2">pulmonology</span>
                                                <div className="text-sm text-white font-medium">Respo</div>
                                                <div className="text-xs text-yellow-400">Monitor</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                             </div>
                        </div>
                    </div>
                )}


                {/* ================= ACT 4: TECHNICAL CREDIBILITY (11s - 13s) ================= */}
                {isBetween(11, 13) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505] px-6">
                         <div className="grid grid-cols-3 gap-8 animate-fade-in-up mb-6">
                             {['graphic_eq', 'visibility', 'psychology'].map((icon, i) => (
                                 <div key={i} className="flex flex-col items-center">
                                     <span className="material-symbol text-5xl text-[#A8C7FA] mb-2">{icon}</span>
                                 </div>
                             ))}
                         </div>
                         <div className="text-gray-400 text-xs font-mono border border-gray-800 px-3 py-1 rounded">GEMINI 3 PRO</div>
                    </div>
                )}


                {/* ================= ACT 5: IMPACT & VISION (13s - 15s) ================= */}
                {isBetween(13, 15.5) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-black">
                        <div className="animate-fade-in-up">
                            <span className="material-symbol text-8xl text-transparent bg-clip-text bg-gradient-to-tr from-[#4285F4] to-[#9B72CB] mb-4">graphic_eq</span>
                            <h1 className="text-3xl font-medium text-white mb-2">VitalVoice AI</h1>
                            <div className="text-[#A8C7FA] opacity-80 text-xs mb-6">vitalvoiceai.varunchundru.com</div>
                            
                            <button onClick={restart} className="text-gray-600 hover:text-white flex items-center gap-2 transition-colors text-xs justify-center mx-auto">
                                <span className="material-symbol text-base">replay</span> Replay
                            </button>
                        </div>
                    </div>
                )}


                {/* ================= GLOBAL OVERLAYS ================= */}
                
                {/* Narration Subtitles */}
                <div className="absolute bottom-16 left-0 right-0 text-center px-4 pointer-events-none">
                    <p className="text-white/90 text-lg font-medium drop-shadow-lg max-w-4xl mx-auto leading-relaxed transition-all duration-300">
                        {getNarration()}
                    </p>
                </div>

                {/* Close Button */}
                <button onClick={onClose} className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-md group">
                    <span className="material-symbol text-white group-hover:scale-110 transition-transform">close</span>
                </button>

                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#111] z-50">
                    <div 
                        className="h-full bg-white transition-all duration-100 ease-linear"
                        style={{ width: `${(currentTime / DURATION) * 100}%` }}
                    />
                </div>
                
                {/* Controls */}
                <div className="absolute bottom-4 right-6 flex gap-4 z-50">
                    <button onClick={() => setIsPlaying(!isPlaying)} className="text-white hover:text-[#A8C7FA]">
                        <span className="material-symbol">{isPlaying ? 'pause' : 'play_arrow'}</span>
                    </button>
                </div>

            </div>
        </div>
    );
};

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸', prompt: "Tell me about a memorable meal you've had recently. Describe the flavors, the place, and who you were with." },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧', prompt: "Tell me about a memorable meal you've had recently. Describe the flavors, the place, and who you were with." },
  { code: 'es-ES', name: 'Español', flag: '🇪🇸', prompt: "Cuéntame sobre una comida memorable que hayas tenido recientemente. Describe los sabores, el lugar y con quién estabas." },
  { code: 'fr-FR', name: 'Français', flag: '🇫🇷', prompt: "Parlez-moi d'un repas mémorable que vous avez pris récemment. Décrivez les saveurs, le lieu et avec qui vous étiez." },
  { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪', prompt: "Erzählen Sie mir von einer unvergesslichen Mahlzeit, die Sie kürzlich hatten. Beschreiben Sie die Aromen, den Ort und mit wem Sie dort waren." },
  { code: 'pt-BR', name: 'Português (BR)', flag: '🇧🇷', prompt: "Conte-me sobre uma refeição memorável que você teve recentemente. Descreva os sabores, o lugar e com quem você estava." },
  { code: 'zh-CN', name: '中文 (Simplified)', flag: '🇨🇳', prompt: "告诉我你最近吃过的一次难忘的饭局。描述一下味道、地点以及你和谁在一起。" },
  { code: 'ja-JP', name: '日本語', flag: '🇯🇵', prompt: "最近食べた思い出に残る食事について教えてください。味や場所、誰と一緒にいたかなどを説明してください。" },
  { code: 'ko-KR', name: '한국어', flag: '🇰🇷', prompt: "최근에 있었던 기억에 남는 식사에 대해 이야기해 주세요. 맛, 장소, 그리고 누구와 함께 있었는지 묘사해 주세요." },
  { code: 'hi-IN', name: 'हिन्दी', flag: '🇮🇳', prompt: "मुझे हाल ही में किए गए एक यादगार भोजन के बारे में बताएं। स्वाद, जगह और आप किसके साथ थे, इसका वर्णन करें।" },
  { code: 'bn-IN', name: 'বাংলা', flag: '🇧🇩', prompt: "আপনার সাম্প্রতিক কোনো স্মরণীয় খাবারের অভিজ্ঞতা সম্পর্কে বলুন। স্বাদ, জায়গা এবং আপনি কার সাথে ছিলেন তা বর্ণনা করুন।" },
  { code: 'ar-SA', name: 'العربية', flag: '🇸🇦', prompt: "أخبرني عن وجبة لا تُنسى تناولتها مؤخرًا. صف النكهات والمكان ومن كان معك." },
  { code: 'ru-RU', name: 'Русский', flag: '🇷🇺', prompt: "Расскажите мне о запоминающейся еде, которая у вас была недавно. Опишите вкусы, место и то, с кем вы были." },
  { code: 'it-IT', name: 'Italiano', flag: '🇮🇹', prompt: "Parlami di un pasto memorabile che hai fatto di recente. Descrivi i sapori, il luogo e con chi eri." },
  { code: 'id-ID', name: 'Bahasa Indonesia', flag: '🇮🇩', prompt: "Ceritakan tentang makanan yang paling berkesan yang baru saja Anda nikmati. Jelaskan rasanya, tempatnya, dan dengan siapa Anda pergi." },
  { code: 'tr-TR', name: 'Türkçe', flag: '🇹🇷', prompt: "Bana yakın zamanda yediğiniz unutulmaz bir yemekten bahsedin. Lezzetleri, mekanı ve kiminle olduğunuzu anlatın." },
  { code: 'vi-VN', name: 'Tiếng Việt', flag: '🇻🇳', prompt: "Hãy kể cho tôi nghe về một bữa ăn đáng nhớ mà bạn đã có gần đây. Mô tả hương vị, địa điểm và bạn đã đi cùng ai." },
  { code: 'th-TH', name: 'ไทย', flag: '🇹🇭', prompt: "เล่าให้ฉันฟังเกี่ยวกับมื้ออาหารที่น่าจดจำที่คุณทานเมื่อเร็วๆ นี้ อธิบายรสชาติ สถานที่ และคุณไปกับใคร" },
  { code: 'pl-PL', name: 'Polski', flag: '🇵🇱', prompt: "Opowiedz mi o niezapomnianym posiłku, który ostatnio jadłeś. Opisz smaki, miejsce i to, z kim byłeś." },
  { code: 'nl-NL', name: 'Nederlands', flag: '🇳🇱', prompt: "Vertel me over een gedenkwaardige maaltijd die je onlangs hebt gehad. Beschrijf de smaken, de plaats en met wie je was." },
  { code: 'sv-SE', name: 'Svenska', flag: '🇸🇪', prompt: "Berätta om en minnesvärd måltid du ätit nyligen. Beskriv smakerna, platsen och vem du var med." },
  { code: 'el-GR', name: 'Ελληνικά', flag: '🇬🇷', prompt: "Πείτε μου για ένα αξέχαστο γεύμα που είχατε πρόσφατα. Περιγράψτε τις γεύσεις, το μέρος και με ποιον ήσασταν." },
  { code: 'he-IL', name: 'עברית', flag: '🇮🇱', prompt: "ספר לי על ארוחה בלתי נשכחת שהייתה לך לאחרונה. תאר את הטעמים, המקום ועם מי היית." },
  { code: 'fil-PH', name: 'Filipino', flag: '🇵🇭', prompt: "Kuwentuhan mo ako tungkol sa isang hindi malilimutang pagkain na kinain mo kamakailan. Ilarawan ang mga lasa, lugar, at kung sino ang kasama mo." },
];

const App: React.FC = () => {
  const [screen, setScreen] = useState<AppScreen>(AppScreen.INTRO);
  const [selectedLanguage, setSelectedLanguage] = useState(SUPPORTED_LANGUAGES[0]);
  
  // New Modals State
  const [showTechModal, setShowTechModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showAIReasoning, setShowAIReasoning] = useState(false);

  // Recording State
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(30);
  
  // Upload State
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Analysis State
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<HealthAnalysis | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  
  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatRecording, setIsChatRecording] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chatMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatAudioChunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // --- Logic ---

  // Sample Data Logic
  const loadSampleData = () => {
      setScreen(AppScreen.ANALYZING);
      setAnalysisStep(0);
      const stepInterval = setInterval(() => {
          setAnalysisStep(prev => prev + 1);
      }, 600); // Faster for demo

      setTimeout(() => {
          clearInterval(stepInterval);
          setAnalysisResult(SAMPLE_ANALYSIS_RESULT);
          setScreen(AppScreen.RESULTS);
      }, 3500);
  };

  const exportPDF = () => {
      if (analysisResult) {
        generatePDF(analysisResult);
      }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        setScreen(AppScreen.FACE_PROMPT);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTimer(30);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access is required.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Reset recording state when entering recording screen or canceling
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    setIsRecording(false);
    setTimer(30);
    setAudioBlob(null);
    setScreen(AppScreen.INTRO);
  };

  useEffect(() => {
    let interval: any;
    if (isRecording && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (isRecording && timer === 0) {
      stopRecording();
    }
    return () => clearInterval(interval);
  }, [isRecording, timer]);

  const startCamera = async () => {
    setScreen(AppScreen.FACE_CAPTURE);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera", err);
      performAnalysis(null);
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
        
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) stream.getTracks().forEach(t => t.stop());
        
        const b64 = dataUrl.split(',')[1];
        setImageBase64(b64);
        performAnalysis(b64);
      }
    }
  };

  const stopCameraAndBack = () => {
    if (videoRef.current && videoRef.current.srcObject) {
       const stream = videoRef.current.srcObject as MediaStream;
       stream.getTracks().forEach(t => t.stop());
    }
    setScreen(AppScreen.FACE_PROMPT);
  };

  const skipFaceScan = () => {
    performAnalysis(null);
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedAudioFile(e.target.files[0]);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startAnalysisFromUpload = () => {
    if (!uploadedAudioFile) return;
    
    setScreen(AppScreen.ANALYZING);
    setAnalysisStep(0);
    
    const stepInterval = setInterval(() => {
      setAnalysisStep(prev => prev + 1);
    }, 1500);

    const process = async () => {
      try {
        const audioReader = new FileReader();
        const audioPromise = new Promise<string>((resolve) => {
           audioReader.onloadend = () => resolve((audioReader.result as string).split(',')[1]);
           audioReader.readAsDataURL(uploadedAudioFile);
        });
        const audioB64 = await audioPromise;

        let imgB64 = undefined;
        let imgMime = undefined;
        if (uploadedImageFile) {
           const imgReader = new FileReader();
           const imgPromise = new Promise<string>((resolve) => {
             imgReader.onloadend = () => resolve((imgReader.result as string).split(',')[1]);
             imgReader.readAsDataURL(uploadedImageFile);
           });
           imgB64 = await imgPromise;
           imgMime = uploadedImageFile.type;
        }

        const result = await analyzeHealth(
          audioB64, 
          uploadedAudioFile.type, 
          imgB64, 
          imgMime,
          selectedLanguage.name
        );
        
        clearInterval(stepInterval);
        setAnalysisResult(result);
        setScreen(AppScreen.RESULTS);

      } catch (e) {
        console.error(e);
        clearInterval(stepInterval);
        alert("Validation analysis failed. Please check file format.");
        setScreen(AppScreen.UPLOAD_CONFIG);
      }
    };

    process();
  };

  const performAnalysis = async (imgB64: string | null) => {
    setScreen(AppScreen.ANALYZING);
    
    const steps = [
      "Extracting voice biomarkers...",
      "Analyzing speech patterns...",
      "Evaluating vocal characteristics...",
      "Correlating with multimodal data...",
      "Generating personalized insights..."
    ];
    
    let currentStep = 0;
    const stepInterval = setInterval(() => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        setAnalysisStep(currentStep);
      }
    }, 1500);

    try {
      if (!audioBlob) throw new Error("No audio recorded");

      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        try {
          const result = await analyzeHealth(base64Audio, "audio/webm", imgB64 || undefined, "image/jpeg", selectedLanguage.name);
          setAnalysisResult(result);
          clearInterval(stepInterval);
          setScreen(AppScreen.RESULTS);
        } catch (error) {
          console.error(error);
          alert("Analysis failed. Please try again.");
          setScreen(AppScreen.INTRO);
        }
      };
    } catch (e) {
      console.error(e);
      clearInterval(stepInterval);
      setScreen(AppScreen.INTRO);
    }
  };

  // --- Chat Logic Enhancements ---

  const startChatRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chatMediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chatAudioChunksRef.current = [];

      chatMediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chatAudioChunksRef.current.push(event.data);
        }
      };

      chatMediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(chatAudioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Convert to Base64 for sending
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
            const base64Audio = (reader.result as string).split(',')[1];
            sendAudioMessage(base64Audio, audioUrl);
        };
        
        stream.getTracks().forEach(track => track.stop());
      };

      chatMediaRecorderRef.current.start();
      setIsChatRecording(true);
    } catch (err) {
      console.error("Error accessing microphone for chat:", err);
      alert("Microphone access is required.");
    }
  };

  const stopChatRecording = () => {
    if (chatMediaRecorderRef.current && isChatRecording) {
      chatMediaRecorderRef.current.stop();
      setIsChatRecording(false);
    }
  };

  const sendAudioMessage = async (base64Audio: string, audioUrl: string) => {
    if (!analysisResult) return;

    const userMsg: ChatMessage = { 
        role: 'user', 
        text: '🎤 Audio Message', 
        isAudio: true, 
        audioUrl: audioUrl 
    };
    
    setChatHistory(prev => [...prev, userMsg]);
    setIsChatLoading(true);

    const responseText = await chatWithHealthAssistant(
        chatHistory, 
        "", 
        analysisResult, 
        selectedLanguage.name,
        base64Audio
    );
    
    setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
    setIsChatLoading(false);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !analysisResult) return;

    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);

    const responseText = await chatWithHealthAssistant(chatHistory, userMsg.text, analysisResult, selectedLanguage.name);
    
    setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
    setIsChatLoading(false);
  };

  const speakText = (text: string) => {
    // Basic text cleanup for speech
    const cleanText = text.replace(/[#*]/g, ''); 
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    const voices = window.speechSynthesis.getVoices();
    const langCode = selectedLanguage.code.split('-')[0];
    const voice = voices.find(v => v.lang.startsWith(langCode));
    if (voice) utterance.voice = voice;
    
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);


  // --- Render Sections (Responsive Web/Mobile) ---

  const renderIntro = () => (
    <div className="flex flex-col min-h-[100dvh] w-full max-w-[100vw] relative overflow-hidden bg-[#131314]">
      {/* Background Ambience - Reduced size on mobile to prevent overflow/glitch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] lg:w-[800px] bg-blue-500/10 blur-[80px] sm:blur-[120px] rounded-full pointer-events-none"></div>
      
      {/* Modals */}
      {showTechModal && <TechModal onClose={() => setShowTechModal(false)} />}
      {showDemoModal && <CinematicDemoModal onClose={() => setShowDemoModal(false)} />}

      {/* Header Area (Language) */}
      <div className="w-full flex justify-end p-4 sm:p-6 z-20 relative shrink-0">
          <div className="relative group" data-tour="language-selector">
             <select 
               value={selectedLanguage.code}
               onChange={(e) => {
                  const lang = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
                  if(lang) setSelectedLanguage(lang);
               }}
               className="appearance-none bg-[#1E1F20]/90 backdrop-blur-md border border-[#444746] text-[#E3E3E3] py-2 pl-3 pr-8 rounded-full text-xs sm:text-sm font-medium focus:outline-none focus:border-[#A8C7FA] hover:bg-[#28292A] cursor-pointer transition-colors max-w-[150px] sm:max-w-none truncate"
             >
               {SUPPORTED_LANGUAGES.map(lang => (
                 <option key={lang.code} value={lang.code}>
                   {lang.flag} {lang.name}
                 </option>
               ))}
             </select>
             <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
               <span className="material-symbol text-[16px] sm:text-[18px] text-gray-400">language</span>
             </div>
          </div>
      </div>

      {/* Main Content - Centered */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 z-10 w-full">
        <div className="w-full max-w-4xl flex flex-col items-center text-center space-y-6 sm:space-y-10">
          
          {/* Validity Badge */}
          <div className="inline-flex items-center gap-2 bg-[#1E1F20] px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-[#444746] shadow-lg">
             <span className="material-symbol text-emerald-400 text-[16px] sm:text-[18px]">verified</span>
             <span className="text-[10px] sm:text-xs font-medium text-gray-300 tracking-wide">CLINICAL VALIDITY READY</span>
          </div>

          {/* Title Area */}
          <div className="space-y-4 sm:space-y-6">
            <div className="relative inline-block">
               <span className="material-symbol text-6xl sm:text-8xl text-transparent bg-clip-text bg-gradient-to-tr from-[#4285F4] to-[#9B72CB] animate-pulse">graphic_eq</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-normal text-white tracking-tight px-2">
              VitalVoice <span className="text-gemini font-medium">AI</span>
            </h1>
            <p className="text-[#C4C7C5] text-base sm:text-lg md:text-2xl leading-relaxed max-w-xs sm:max-w-2xl mx-auto font-light px-2">
              Advanced health screening powered by <span className="text-white font-medium">Gemini 3 Pro</span>.
              <br/>
              <span className="text-xs sm:text-sm mt-2 block opacity-70">
                  Selected Language: <span className="text-[#A8C7FA] font-medium">{selectedLanguage.name}</span>
              </span>
            </p>
            
            {/* Tour & Demo Buttons */}
            <div className="flex items-center justify-center gap-4">
                <button onClick={() => setShowDemoModal(true)} className="inline-flex items-center gap-2 text-[#A8C7FA] hover:text-[#D3E3FD] font-medium transition-colors text-sm sm:text-base">
                <span className="material-symbol">smart_display</span>
                Watch Demo
                </button>
            </div>
          </div>

          {/* Chips */}
          <div className="flex gap-2 sm:gap-3 justify-center flex-wrap px-4">
            {['Neurological', 'Respiratory', 'Mental Health', 'Cardiovascular'].map((item) => (
               <div key={item} className="bg-[#1E1F20] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-[#444746] text-xs sm:text-sm text-gray-300">
                 {item}
               </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-4 w-full max-w-md mt-4 sm:mt-8 px-4">
            <div className="flex flex-col sm:flex-row gap-4 w-full">
                <button 
                data-tour="start-btn"
                onClick={() => setScreen(AppScreen.RECORDING)}
                className="w-full sm:flex-1 h-14 sm:h-16 rounded-full bg-[#D3E3FD] hover:bg-[#C4D7FC] text-[#041E49] font-medium text-base sm:text-lg flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 border border-transparent shadow-xl"
                >
                <span className="material-symbol">mic</span>
                Start Screening
                </button>
                
                <div className="w-full sm:flex-1 relative">
                <button 
                    data-tour="upload-btn"
                    onClick={() => setScreen(AppScreen.UPLOAD_CONFIG)}
                    className="w-full h-14 sm:h-16 rounded-full bg-[#1E1F20] hover:bg-[#28292A] text-[#E3E3E3] font-medium text-base sm:text-lg flex items-center justify-center gap-2 border border-[#444746] transition-all hover:border-gray-400 active:scale-95"
                >
                    <span className="material-symbol">upload_file</span>
                    Upload Data
                </button>
                {/* Info Icon */}
                <div className="absolute -top-2 -right-2 group z-20">
                    <div 
                        data-tour="upload-info"
                        className="bg-[#444746] text-gray-200 rounded-full w-6 h-6 flex items-center justify-center shadow-lg cursor-help hover:bg-[#5E5F60] transition-colors"
                    >
                        <span className="material-symbol text-[14px]">info</span>
                    </div>
                </div>
                </div>
            </div>
            {/* Try Sample Button */}
             <button 
                onClick={loadSampleData}
                className="w-full h-10 sm:h-12 rounded-full bg-transparent hover:bg-white/5 text-[#A8C7FA] font-medium text-sm border border-[#A8C7FA]/30 flex items-center justify-center gap-2 transition-all"
            >
                <span className="material-symbol text-[18px]">science</span>
                Try with Sample Data (Instant)
            </button>
          </div>

        </div>
      </div>

      {/* Footer / Social Proof */}
      <div className="p-4 sm:pb-8 text-center z-10 w-full shrink-0 space-y-4">
        <div className="flex flex-col items-center justify-center gap-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Trusted Research</p>
            <div className="flex gap-4 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                 {/* Mock Logos */}
                 <div className="h-6 w-20 bg-white/10 rounded flex items-center justify-center text-[8px] font-bold">HealthTech</div>
                 <div className="h-6 w-20 bg-white/10 rounded flex items-center justify-center text-[8px] font-bold">MedAI</div>
                 <div className="h-6 w-20 bg-white/10 rounded flex items-center justify-center text-[8px] font-bold">ClinicalJS</div>
            </div>
        </div>
        <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
            <span>Privacy First</span>
            <span>•</span>
            <span>Secure Processing</span>
            <span>•</span>
            <button onClick={() => setShowTechModal(true)} className="text-[#A8C7FA] hover:underline">View Architecture</button>
        </div>
      </div>
    </div>
  );

  const renderUploadConfig = () => (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 sm:p-6 bg-[#131314] w-full">
      <div className="w-full max-w-2xl bg-[#1E1F20] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 border border-[#444746] shadow-2xl">
        <div className="flex items-center gap-4 mb-6 sm:mb-8">
          <button onClick={() => setScreen(AppScreen.INTRO)} className="p-2 sm:p-3 rounded-full hover:bg-[#28292A] border border-transparent hover:border-[#444746]">
            <span className="material-symbol text-gray-200">arrow_back</span>
          </button>
          <h2 className="text-xl sm:text-2xl text-white font-normal">Validation Mode</h2>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Audio Input */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`relative h-48 sm:h-64 flex flex-col items-center justify-center p-4 sm:p-6 rounded-[24px] border-2 border-dashed transition-all cursor-pointer group ${uploadedAudioFile ? 'border-[#A8C7FA] bg-[#004A77]/10' : 'border-[#444746] hover:border-[#A8C7FA] hover:bg-[#28292A]'}`}
            >
              <input type="file" ref={fileInputRef} onChange={handleAudioFileChange} accept="audio/*" className="hidden" />
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#131314] flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                 <span className={`material-symbol text-2xl sm:text-3xl ${uploadedAudioFile ? 'text-[#A8C7FA]' : 'text-gray-400'}`}>audio_file</span>
              </div>
              <span className="text-base sm:text-lg font-medium text-gray-200 mb-1">{uploadedAudioFile ? 'Audio Loaded' : 'Upload Audio'}</span>
              <span className="text-xs sm:text-sm text-gray-500 max-w-[200px] truncate text-center">{uploadedAudioFile ? uploadedAudioFile.name : '.wav, .mp3, .webm'}</span>
            </div>

            {/* Image Input */}
            <div 
              onClick={() => imageInputRef.current?.click()}
              className={`relative h-48 sm:h-64 flex flex-col items-center justify-center p-4 sm:p-6 rounded-[24px] border-2 border-dashed transition-all cursor-pointer group ${uploadedImageFile ? 'border-[#E8DEF8] bg-[#4A4458]/10' : 'border-[#444746] hover:border-[#E8DEF8] hover:bg-[#28292A]'}`}
            >
              <input type="file" ref={imageInputRef} onChange={handleImageFileChange} accept="image/*" className="hidden" />
              {imagePreview ? (
                <img src={imagePreview} className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover mb-4 border-2 border-[#E8DEF8]" />
              ) : (
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#131314] flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                  <span className="material-symbol text-2xl sm:text-3xl text-gray-400">add_a_photo</span>
                </div>
              )}
               <span className="text-base sm:text-lg font-medium text-gray-200 mb-1">{uploadedImageFile ? 'Image Loaded' : 'Add Face (Optional)'}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 pt-6 border-t border-[#444746]">
           <button 
            onClick={startAnalysisFromUpload}
            disabled={!uploadedAudioFile}
            className="w-full h-12 sm:h-14 rounded-full bg-[#A8C7FA] disabled:bg-[#444746] disabled:text-gray-500 text-[#041E49] font-medium text-base sm:text-lg transition-colors shadow-lg disabled:shadow-none"
          >
            Run Clinical Analysis ({selectedLanguage.name})
          </button>
        </div>
      </div>
    </div>
  );

  const renderRecording = () => (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#131314] p-6 relative w-full">
      <div className="absolute top-6 left-6 z-10">
        <button onClick={cancelRecording} className="p-3 rounded-full hover:bg-[#28292A] border border-transparent hover:border-[#444746] transition-colors">
          <span className="material-symbol text-gray-300">arrow_back</span>
        </button>
      </div>
      
      <div className="w-full max-w-2xl text-center space-y-8 sm:space-y-12">
        {/* Prompt Card */}
        <div className="surface-container-high p-6 sm:p-8 rounded-[32px] border border-[#444746] shadow-xl transform transition-all mx-2">
          <div className="flex items-center justify-between mb-4">
             <span className="text-xs sm:text-sm font-bold text-[#A8C7FA] uppercase tracking-wider block">Voice Screening Prompt</span>
             <span className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1">
               <span className="material-symbol text-[14px]">language</span> {selectedLanguage.name}
             </span>
          </div>
          <p className="text-xl sm:text-2xl md:text-3xl text-[#E3E3E3] font-normal leading-relaxed">
            "{selectedLanguage.prompt}"
            <br/>
            <span className="text-sm sm:text-base text-gray-500 mt-2 block">(Please speak in {selectedLanguage.name})</span>
          </p>
        </div>

        {/* Visualizer & Timer */}
        <div className="space-y-4 sm:space-y-6">
           <div className="text-6xl sm:text-8xl font-light text-white font-mono tabular-nums tracking-tighter">
              00:{timer < 10 ? `0${timer}` : timer}
           </div>
           <div className="w-full h-24 sm:h-32 flex items-center justify-center">
             <div className="w-full max-w-lg px-4">
                <Waveform isRecording={isRecording} />
             </div>
           </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center pb-8 sm:pb-0">
          {!isRecording ? (
            <button 
              onClick={startRecording}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#FFB4AB] hover:bg-[#FF897D] flex items-center justify-center transition-all shadow-[0_0_40px_rgba(255,180,171,0.3)] hover:scale-110 active:scale-95"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#690005] rounded-[12px]"></div>
            </button>
          ) : (
            <button 
              onClick={stopRecording}
              className="px-8 sm:px-10 h-14 sm:h-16 rounded-full bg-[#323335] border border-[#444746] text-[#E3E3E3] font-medium flex items-center gap-3 hover:bg-[#444746] transition-colors text-base sm:text-lg"
            >
              <span className="material-symbol">stop_circle</span>
              Stop Analysis
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderFacePrompt = () => (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#131314] p-6 relative w-full">
      <div className="absolute top-6 left-6">
        <button onClick={() => setScreen(AppScreen.INTRO)} className="p-3 rounded-full hover:bg-[#28292A] border border-transparent hover:border-[#444746] transition-colors">
          <span className="material-symbol text-gray-300">arrow_back</span>
        </button>
      </div>

       <div className="w-full max-w-lg text-center space-y-6 sm:space-y-8">
        <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto rounded-full bg-[#1E1F20] flex items-center justify-center border border-[#444746] shadow-2xl">
          <span className="material-symbol text-5xl sm:text-6xl text-[#A8C7FA]">face</span>
        </div>
        <div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-normal text-white mb-3 sm:mb-4">Enhance Accuracy?</h2>
          <p className="text-[#C4C7C5] text-base sm:text-lg leading-relaxed">
            Adding a face scan helps detect pallor, fatigue, and other visual biomarkers not present in voice alone.
          </p>
        </div>
        
        <div className="flex flex-col gap-3 pt-4 px-4">
          <button 
            onClick={startCamera}
            className="w-full h-14 sm:h-16 rounded-full bg-[#A8C7FA] text-[#041E49] font-medium text-lg hover:bg-[#D3E3FD] transition-colors"
          >
            Enable Camera
          </button>
          <button 
            onClick={skipFaceScan}
            className="w-full h-14 sm:h-16 rounded-full text-[#A8C7FA] font-medium text-lg hover:bg-[#1E1F20] transition-colors"
          >
            Skip for Now
          </button>
        </div>
      </div>
    </div>
  );

  const renderFaceCapture = () => (
    <div className="min-h-[100dvh] bg-black flex flex-col md:flex-row relative w-full overflow-hidden">
      {/* Back Button for Camera */}
      <div className="absolute top-6 left-6 z-20">
        <button onClick={stopCameraAndBack} className="p-3 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/80 border border-white/20 transition-colors">
          <span className="material-symbol text-white">arrow_back</span>
        </button>
      </div>

      {/* Camera View */}
      <div className="relative flex-1 h-[70vh] md:h-screen overflow-hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Desktop Overlay Guide */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <div className="w-[280px] h-[360px] sm:w-[300px] sm:h-[400px] border-2 border-white/40 rounded-[50%] border-dashed"></div>
        </div>
        
        <div className="absolute top-8 left-0 right-0 text-center pointer-events-none px-4">
           <span className="bg-black/60 backdrop-blur-md text-white px-4 py-2 sm:px-6 sm:py-3 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap">Position face in oval</span>
        </div>
      </div>

      {/* Controls Sidebar (Desktop) / Bottom Bar (Mobile) */}
      <div className="h-[30vh] md:h-screen md:w-80 bg-[#131314] flex flex-col items-center justify-center p-6 border-l border-[#444746] z-10">
         <button 
          onClick={captureImage}
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white flex items-center justify-center p-1.5 hover:scale-105 transition-transform"
        >
          <div className="w-full h-full bg-white rounded-full"></div>
        </button>
        <p className="mt-6 text-gray-400 text-sm">Tap to capture</p>
      </div>
    </div>
  );

  const renderAnalyzing = () => {
    // Helper to get the correct icon for each step
    const getAnalysisIcon = (step: number) => {
        // Map step (0-4) to icon
        // 0: Extracting audio features... -> graphic_eq
        // 1: Analyzing facial microsignals... -> face
        // 2: Correlating multimodal data... -> model_training (updated)
        // 3: Running clinical models... -> neurology
        // 4: Finalizing report... -> check_circle
        const icons = ['graphic_eq', 'face', 'model_training', 'neurology', 'check_circle'];
        return icons[step % icons.length] || 'hourglass_empty';
    };

    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#131314] p-6 text-center w-full">
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 mb-8 sm:mb-12">
             {/* Custom Spinner */}
             <svg className="animate-spin w-full h-full text-[#A8C7FA]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-10" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                 <span className="material-symbol text-4xl sm:text-5xl text-white animate-pulse transition-all duration-300">
                     {getAnalysisIcon(analysisStep)}
                 </span>
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl text-white font-normal mb-4">Analyzing Biomarkers</h3>
          <div className="h-8">
            <p className="text-[#A8C7FA] text-base sm:text-lg animate-pulse font-medium px-4">
              {["Extracting audio features...", "Analyzing facial microsignals...", "Correlating multimodal data...", "Running clinical models...", "Finalizing report..."][analysisStep % 5]}
            </p>
          </div>
        </div>
    );
  };

  const renderResults = () => {
    if (!analysisResult) return null;

    return (
      <div className="min-h-[100dvh] bg-[#131314] flex flex-col w-full">
        {/* App Bar */}
        <header className="sticky top-0 z-50 bg-[#131314]/80 backdrop-blur-md border-b border-[#444746] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <span className="material-symbol text-[#A8C7FA]">vital_signs</span>
             <h1 className="text-lg sm:text-xl font-medium text-white">Health Insights</h1>
           </div>
           <div className="flex gap-2">
             <button onClick={() => setScreen(AppScreen.INTRO)} className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full hover:bg-[#28292A] text-xs sm:text-sm font-medium text-gray-300 border border-transparent hover:border-[#444746]">
               New Scan
             </button>
             <button onClick={exportPDF} className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full hover:bg-[#28292A] text-xs sm:text-sm font-medium text-[#A8C7FA] border border-[#A8C7FA]/30 hidden sm:block">
               Export PDF
             </button>
             <button onClick={() => setScreen(AppScreen.CHAT)} className="px-4 py-1.5 sm:px-6 sm:py-2 rounded-full bg-[#A8C7FA] text-[#041E49] text-xs sm:text-sm font-bold shadow-lg hover:bg-[#D3E3FD] transition-colors hidden md:block">
               Ask Assistant
             </button>
           </div>
        </header>

        {/* Dashboard Grid */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-12 max-w-[1600px] mx-auto w-full pb-24 md:pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            
            {/* Left Col: Score & Summary (4 cols) */}
            <div className="lg:col-span-4 space-y-4 sm:space-y-6">
              <div className="bg-[#1E1F20] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 border border-[#444746] relative overflow-hidden text-center lg:text-left h-full flex flex-col">
                <div className="flex flex-col items-center lg:items-start z-10 relative flex-1">
                   <div className="text-7xl sm:text-8xl md:text-9xl font-medium text-white tracking-tighter mb-2">
                     {analysisResult.overall_wellness_score}
                   </div>
                   <span className="text-xs sm:text-sm font-bold text-[#A8C7FA] uppercase tracking-widest mb-4 sm:mb-6 block">Wellness Score</span>
                   <p className="text-[#C4C7C5] text-base sm:text-lg leading-relaxed mb-6">
                     {analysisResult.summary}
                   </p>
                   
                   {/* AI Reasoning Expandable */}
                   <button 
                    onClick={() => setShowAIReasoning(!showAIReasoning)}
                    className="mt-auto text-sm text-[#A8C7FA] flex items-center gap-1 hover:underline"
                   >
                       <span className="material-symbol text-[18px]">{showAIReasoning ? 'expand_less' : 'expand_more'}</span>
                       View AI Analysis Details
                   </button>
                   
                   {showAIReasoning && (
                       <div className="mt-4 p-4 bg-[#131314] rounded-xl text-left border border-[#444746] animate-fade-in-up w-full">
                           <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Gemini 3 Pro Reasoning</h4>
                           <p className="text-xs text-gray-300 leading-relaxed">
                               AI detected correlation between vocal jitter and respiratory patterns. 
                               Confidence level: <strong>{analysisResult.confidence_level}</strong>. 
                               Analysis prioritized acoustic features indicative of {analysisResult.domain_scores.neurological.concern_level === 'low' ? 'stable' : 'variable'} neurological function.
                           </p>
                       </div>
                   )}
                </div>
                {/* Decoration */}
                <div className="absolute -bottom-10 -right-10 opacity-5 pointer-events-none">
                  <span className="material-symbol text-[200px] sm:text-[300px]">graphic_eq</span>
                </div>
              </div>
            </div>

            {/* Middle Col: Domain Grid (5 cols) */}
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 auto-rows-min">
              {Object.entries(analysisResult.domain_scores).map(([key, data], index) => (
                <ResultCard key={key} title={key} data={data} delay={index * 50} />
              ))}
            </div>

            {/* Right Col: Insights & Actions (3 cols) */}
            <div className="lg:col-span-3 space-y-4 sm:space-y-6">
              {/* Observations */}
              <div className="bg-[#1E1F20] rounded-[24px] p-5 sm:p-6 border border-[#444746]">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbol text-[#A8C7FA]">analytics</span>
                  <h3 className="text-base sm:text-lg font-medium text-white">Observations</h3>
                </div>
                <ul className="space-y-4">
                   {analysisResult.key_observations.map((obs, i) => (
                     <li key={i} className="pb-3 border-b border-[#444746] last:border-0 last:pb-0">
                       <p className="text-[#E3E3E3] text-sm font-medium mb-1">{obs.finding}</p>
                       <p className="text-[#8E918F] text-xs">{obs.significance}</p>
                     </li>
                   ))}
                </ul>
              </div>

              {/* Recommendations */}
              <div className="bg-[#1E1F20] rounded-[24px] p-5 sm:p-6 border border-[#444746]">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbol text-[#D0BCFF]">lightbulb</span>
                  <h3 className="text-base sm:text-lg font-medium text-white">Actions</h3>
                </div>
                <div className="space-y-3">
                  {analysisResult.recommendations.map((rec, i) => (
                    <div key={i} className="bg-[#131314] p-3 rounded-[16px] border border-[#444746]">
                       <div className="flex justify-between items-start mb-1">
                         <span className="text-[#E3E3E3] font-medium text-xs leading-snug">{rec.action}</span>
                         {rec.urgency === 'prompt' && <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 ml-2 mt-1"></span>}
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
          
          <div className="mt-8 sm:mt-12 text-center pb-40 md:pb-0">
            <p className="text-xs text-[#8E918F] max-w-2xl mx-auto px-4">
              DISCLAIMER: {analysisResult.disclaimer}
            </p>
          </div>
        </main>

        {/* Mobile FAB */}
        <div className="fixed bottom-6 right-6 md:hidden z-50">
           <button 
             onClick={() => setScreen(AppScreen.CHAT)}
             className="shadow-2xl bg-[#D3E3FD] text-[#041E49] w-14 h-14 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
           >
             <span className="material-symbol">chat_spark</span>
           </button>
        </div>
      </div>
    );
  };

  const renderChat = () => (
    <div className="h-[100dvh] bg-[#131314] flex flex-col items-center w-full overflow-hidden">
      {/* Header */}
      <div className="w-full border-b border-[#444746] bg-[#131314] p-3 sm:p-4 flex items-center justify-between sticky top-0 z-20 shrink-0">
         <div className="flex items-center gap-3">
            <button onClick={() => setScreen(AppScreen.RESULTS)} className="p-2 rounded-full hover:bg-[#28292A] transition-colors">
              <span className="material-symbol text-gray-400">arrow_back</span>
            </button>
            <span className="text-base sm:text-lg font-medium text-white">VitalVoice Assistant</span>
         </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 w-full max-w-3xl flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 pb-24">
          <div className="flex justify-start">
             <div className="bg-[#1E1F20] max-w-[90%] md:max-w-[80%] p-4 sm:p-5 rounded-[24px] rounded-tl-[4px] text-[#E3E3E3] text-sm md:text-base leading-relaxed border border-[#444746]">
               I've analyzed your results. I can explain the neurological indicators in your voice or suggest breathing exercises based on the respiratory data. What would you like to know?
             </div>
          </div>

          {chatHistory.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] md:max-w-[80%] p-4 sm:p-5 rounded-[24px] text-sm md:text-base leading-relaxed shadow-md ${
                msg.role === 'user' 
                ? 'bg-[#A8C7FA] text-[#041E49] rounded-tr-[4px]' 
                : 'bg-[#1E1F20] text-[#E3E3E3] rounded-tl-[4px] border border-[#444746]'
              }`}>
                {msg.isAudio ? (
                    <div className="flex items-center gap-2 sm:gap-3">
                        <span className="material-symbol text-xl sm:text-2xl">graphic_eq</span>
                        <span>Audio Message</span>
                        {msg.audioUrl && (
                            <audio src={msg.audioUrl} controls className="h-8 w-28 sm:w-48 ml-2 rounded opacity-80" />
                        )}
                    </div>
                ) : (
                    msg.role === 'model' 
                      ? <MarkdownRenderer content={msg.text} />
                      : msg.text
                )}

                {msg.role === 'model' && (
                    <div className="mt-3 pt-3 border-t border-white/10 flex justify-end">
                        <button 
                            onClick={() => speakText(msg.text)}
                            className="flex items-center gap-1.5 text-xs font-medium opacity-60 hover:opacity-100 transition-opacity"
                        >
                            <span className="material-symbol text-[16px]">volume_up</span>
                            Listen
                        </button>
                    </div>
                )}
              </div>
            </div>
          ))}
          
          {isChatLoading && (
            <div className="flex justify-start">
              <div className="bg-[#1E1F20] p-4 sm:p-5 rounded-[24px] rounded-tl-[4px] flex gap-1.5 items-center border border-[#444746]">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="w-full p-3 sm:p-4 md:p-6 bg-[#131314] md:bg-transparent shrink-0">
          <form onSubmit={handleChatSubmit} className="relative max-w-3xl mx-auto flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about your health..." 
                  className="w-full bg-[#1E1F20] text-[#E3E3E3] rounded-full pl-5 pr-12 sm:pl-6 sm:pr-14 py-3 sm:py-4 md:py-5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[#A8C7FA]/50 placeholder-gray-500 transition-all border border-[#444746]"
                />
                <button 
                  type="submit" 
                  disabled={!chatInput.trim() || isChatLoading}
                  className="absolute right-1.5 top-1.5 sm:top-2 md:top-3 w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-[#A8C7FA] text-[#041E49] flex items-center justify-center disabled:opacity-0 hover:bg-[#D3E3FD] transition-all transform scale-100 disabled:scale-90"
                >
                   <span className="material-symbol text-[18px] sm:text-[20px] md:text-[24px]">arrow_upward</span>
                </button>
            </div>
            
            {/* Microphone Button */}
            <button 
                type="button"
                onMouseDown={startChatRecording}
                onMouseUp={stopChatRecording}
                onTouchStart={startChatRecording}
                onTouchEnd={stopChatRecording}
                className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all ${
                    isChatRecording 
                    ? 'bg-red-500 text-white scale-110 shadow-[0_0_20px_rgba(239,68,68,0.5)]' 
                    : 'bg-[#2E2F30] text-[#A8C7FA] hover:bg-[#3C3D3F] border border-[#444746]'
                }`}
            >
                <span className="material-symbol text-[20px] sm:text-[24px] md:text-[28px]">{isChatRecording ? 'mic' : 'mic_none'}</span>
            </button>

          </form>
          <p className="text-center text-[10px] sm:text-xs text-[#444746] mt-2 sm:mt-3">VitalVoice AI can make mistakes.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full bg-[#131314] text-[#E3E3E3] font-sans selection:bg-blue-500/30 overflow-x-hidden">
       {screen === AppScreen.INTRO && renderIntro()}
       {screen === AppScreen.UPLOAD_CONFIG && renderUploadConfig()}
       {screen === AppScreen.RECORDING && renderRecording()}
       {screen === AppScreen.FACE_PROMPT && renderFacePrompt()}
       {screen === AppScreen.FACE_CAPTURE && renderFaceCapture()}
       {screen === AppScreen.ANALYZING && renderAnalyzing()}
       {screen === AppScreen.RESULTS && renderResults()}
       {screen === AppScreen.CHAT && renderChat()}
    </div>
  );
};

// Root rendering
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}

export default App;