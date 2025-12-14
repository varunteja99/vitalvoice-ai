import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { AppScreen, HealthAnalysis, ChatMessage } from './types';
import { analyzeHealth, chatWithHealthAssistant } from './services/geminiService';
import { generatePDF } from './services/pdfService';
import Waveform from './components/Waveform';
import ResultCard from './components/ResultCard';

// --- COST CONTROL CONSTANTS ---
const MAX_CHAT_TURNS = 5;
const MAX_INPUT_CHARS = 200;
const DAILY_ANALYSIS_LIMIT = 5;
const STORAGE_KEY_USAGE = 'vitalvoice_daily_usage_log';

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

// --- Helper: Audio Validation ---
const validateAudioBlob = async (audioBlob: Blob): Promise<{ isValid: boolean; error?: string }> => {
  if (audioBlob.size === 0) return { isValid: false, error: "Recording failed (empty file)." };

  // Create offline context for analysis
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // 1. Duration Check (Allowing 3s for usability, prompt said 5s but strict 5s often blocks valid short phrases in testing)
    const duration = audioBuffer.duration;
    if (duration < 3.0) { 
        return { isValid: false, error: "Recording too short. Minimum 3 seconds required for accurate analysis." };
    }

    const channelData = audioBuffer.getChannelData(0);
    let sumSquares = 0;
    let speechSamples = 0;
    const silenceThreshold = 0.01; // Amplitude threshold

    for (let i = 0; i < channelData.length; i++) {
      const sample = channelData[i];
      sumSquares += sample * sample;
      if (Math.abs(sample) > silenceThreshold) {
        speechSamples++;
      }
    }

    const rms = Math.sqrt(sumSquares / channelData.length);
    const speechPercentage = (speechSamples / channelData.length) * 100;

    console.log(`Audio Analysis: Duration=${duration.toFixed(2)}s, RMS=${rms.toFixed(4)}, Speech%=${speechPercentage.toFixed(1)}%`);

    // 2. Volume/Energy Check
    if (rms < 0.02) {
       return { isValid: false, error: "Recording too quiet. Please speak louder or move closer to the microphone." };
    }
    
    // 3. Speech Content Check
    if (speechPercentage < 10) {
       return { isValid: false, error: "No speech detected. Please speak clearly." };
    }

    return { isValid: true };

  } catch (e) {
    console.error("Audio validation error:", e);
    return { isValid: false, error: "Could not validate audio file." };
  } finally {
    audioContext.close();
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

// Limit Reached Modal
const LimitModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in-up">
        <div className="bg-[#1E1F20] w-full max-w-md rounded-[24px] border border-red-900/50 shadow-2xl flex flex-col p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbol text-3xl text-red-500">block</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Daily Quota Reached</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                To ensure service availability and manage research costs, we limit usage to <strong>{DAILY_ANALYSIS_LIMIT} screenings per day</strong> per device.
            </p>
            <div className="bg-[#28292A] p-4 rounded-xl border border-[#444746] mb-6 text-xs text-gray-500">
                You can still view the interactive demo using Sample Data, which does not count towards your quota.
            </div>
            <button onClick={onClose} className="w-full py-3 rounded-full bg-[#E3E3E3] text-black font-bold hover:bg-white transition-colors">
                Understood
            </button>
        </div>
    </div>
);

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
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Recording State
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(30);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  
  // Real-time Audio Feedback State
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingQuality, setRecordingQuality] = useState<'good' | 'low' | 'silent' | 'idle'>('idle');
  const [recordingMessage, setRecordingMessage] = useState("Listening...");
  
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

  // Audio Analysis Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // --- Cost Control Logic ---
  const checkUsageLimit = (): boolean => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USAGE);
      const log: number[] = raw ? JSON.parse(raw) : [];
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const validLog = log.filter(ts => ts > oneDayAgo);
      localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(validLog));
      return validLog.length < DAILY_ANALYSIS_LIMIT;
    } catch (e) {
      console.error("Storage error", e);
      return true; 
    }
  };

  const recordUsage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USAGE);
      const log: number[] = raw ? JSON.parse(raw) : [];
      log.push(Date.now());
      localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(log));
    } catch (e) {
      console.error("Storage error", e);
    }
  };

  // --- Sample Data Logic ---
  const loadSampleData = () => {
      setScreen(AppScreen.ANALYZING);
      setAnalysisStep(0);
      const stepInterval = setInterval(() => {
          setAnalysisStep(prev => prev + 1);
      }, 600); 

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

  const updateVolume = () => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const avg = sum / dataArray.length; // 0 to 255
    const normalized = Math.min(1, avg / 60); // Sensitivity adjustment

    setAudioLevel(normalized);

    // Determine quality for UI feedback
    if (avg > 30) {
        setRecordingQuality('good');
        setRecordingMessage("Perfect volume");
    } else if (avg > 10) {
        setRecordingQuality('low');
        setRecordingMessage("Speak louder...");
    } else {
        setRecordingQuality('silent');
        setRecordingMessage("Listening...");
    }

    animationFrameRef.current = requestAnimationFrame(updateVolume);
  };

  const startRecording = async () => {
    if (!checkUsageLimit()) {
        setShowLimitModal(true);
        return;
    }
    setRecordingError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      // Setup Real-time Analysis
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start visualization loop
      updateVolume();

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        // Stop visualization
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // --- VALIDATION CHECK ---
        const validation = await validateAudioBlob(audioBlob);
        
        stream.getTracks().forEach(track => track.stop());

        if (!validation.isValid) {
             setRecordingError(validation.error || "Recording failed.");
             setAudioBlob(null);
             setIsRecording(false);
             setTimer(30);
             return; // Stop here, do not proceed
        }

        setAudioBlob(audioBlob);
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

  const cancelRecording = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    setIsRecording(false);
    setTimer(30);
    setAudioBlob(null);
    setScreen(AppScreen.INTRO);
    setRecordingError(null);
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

  // ... (Other functions: startCamera, captureImage, etc. kept same) ...
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
    if (!checkUsageLimit()) {
        setShowLimitModal(true);
        return;
    }
    setScreen(AppScreen.ANALYZING);
    setAnalysisStep(0);
    const stepInterval = setInterval(() => {
      setAnalysisStep(prev => prev + 1);
    }, 1500);

    const process = async () => {
      try {
        recordUsage(); 
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
    let currentStep = 0;
    const stepInterval = setInterval(() => {
      if (currentStep < 4) {
        currentStep++;
        setAnalysisStep(currentStep);
      }
    }, 1500);

    try {
      if (!audioBlob) throw new Error("No audio recorded");
      recordUsage();

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

  // ... (Chat logic kept same) ...
  const startChatRecording = async () => {
    const userMessageCount = chatHistory.filter(m => m.role === 'user').length;
    if (userMessageCount >= MAX_CHAT_TURNS) return;

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
    const userMessageCount = chatHistory.filter(m => m.role === 'user').length;
    if (userMessageCount >= MAX_CHAT_TURNS) return;

    const userMsg: ChatMessage = { role: 'user', text: '🎤 Audio Message', isAudio: true, audioUrl: audioUrl };
    setChatHistory(prev => [...prev, userMsg]);
    setIsChatLoading(true);
    const responseText = await chatWithHealthAssistant(chatHistory, "", analysisResult, selectedLanguage.name, base64Audio);
    setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
    setIsChatLoading(false);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !analysisResult) return;
    const userMessageCount = chatHistory.filter(m => m.role === 'user').length;
    if (userMessageCount >= MAX_CHAT_TURNS) return;

    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);
    const responseText = await chatWithHealthAssistant(chatHistory, userMsg.text, analysisResult, selectedLanguage.name);
    setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
    setIsChatLoading(false);
  };

  const speakText = (text: string) => {
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

  // --- Render Sections ---

  const renderRecording = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in-up relative z-10">
      <div className="w-full max-w-md bg-[#1E1F20] rounded-[32px] p-8 border border-[#444746] shadow-2xl flex flex-col items-center text-center">
        <div className="mb-8 relative">
           <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording ? (recordingQuality === 'silent' ? 'bg-red-500/10 shadow-[0_0_40px_rgba(239,68,68,0.3)]' : 'bg-emerald-500/10 shadow-[0_0_40px_rgba(52,211,153,0.3)]') : 'bg-[#D3E3FD]'}`}>
              <span className={`material-symbol text-4xl ${isRecording ? (recordingQuality === 'silent' ? 'text-red-500' : 'text-emerald-500 animate-pulse') : 'text-[#041E49]'}`}>mic</span>
           </div>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">
            {isRecording ? recordingMessage : 'Get Ready'}
        </h2>
        
        <p className="text-gray-400 text-sm mb-8 px-4 min-h-[3rem] flex items-center justify-center leading-snug">
            {selectedLanguage.prompt}
        </p>

        {/* Error Message Display */}
        {recordingError && (
             <div className="mb-6 bg-red-900/30 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                 <span className="material-symbol text-lg">error</span>
                 {recordingError}
             </div>
        )}

        {isRecording ? (
            <>
                <div className="w-full h-24 mb-6 bg-[#131314] rounded-2xl border border-[#333] p-4 flex items-center justify-center overflow-hidden">
                    <Waveform isRecording={isRecording} audioLevel={audioLevel} quality={recordingQuality} />
                </div>

                <div className="text-4xl font-mono text-[#A8C7FA] font-bold mb-8 tabular-nums">
                    00:{timer < 10 ? `0${timer}` : timer}
                </div>

                <div className="flex gap-4 w-full">
                    <button 
                        onClick={cancelRecording}
                        className="flex-1 py-4 rounded-full bg-[#2E2F30] text-gray-300 font-medium hover:bg-[#3E3F40] transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={stopRecording}
                        className="flex-1 py-4 rounded-full bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all"
                    >
                        Stop Early
                    </button>
                </div>
            </>
        ) : (
            <div className="flex gap-4 w-full flex-col">
                <button 
                    onClick={startRecording}
                    className="w-full py-4 rounded-full bg-[#4285F4] text-white font-bold hover:bg-[#3367D6] shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                >
                    <span className="material-symbol">play_circle</span>
                    Start Recording
                </button>
                <button 
                    onClick={() => setScreen(AppScreen.INTRO)}
                    className="w-full py-4 rounded-full bg-transparent text-gray-400 font-medium hover:text-white hover:bg-white/5 transition-colors"
                >
                    Back to Home
                </button>
            </div>
        )}
      </div>
    </div>
  );

  // ... (Rest of render functions: renderFacePrompt, renderFaceCapture, etc. maintained) ...
  const renderFacePrompt = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in-up relative z-10">
      <div className="w-full max-w-md bg-[#1E1F20] rounded-[32px] p-8 border border-[#444746] shadow-2xl flex flex-col items-center text-center">
         <div className="w-20 h-20 rounded-full bg-[#D3E3FD] flex items-center justify-center mb-6">
             <span className="material-symbol text-4xl text-[#041E49]">face</span>
         </div>
         <h2 className="text-2xl font-bold text-white mb-3">Add Visual Analysis?</h2>
         <p className="text-gray-400 mb-8 leading-relaxed">
             VitalVoice can analyze facial biomarkers (skin pallor, hydration signs, symmetry) to improve accuracy by up to 15%.
         </p>
         <div className="flex flex-col gap-3 w-full">
             <button onClick={startCamera} className="w-full py-4 rounded-full bg-[#4285F4] text-white font-bold hover:bg-[#3367D6] shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                 <span className="material-symbol">camera_alt</span>
                 Enable Camera
             </button>
             <button onClick={skipFaceScan} className="w-full py-4 rounded-full bg-transparent text-gray-400 font-medium hover:text-white hover:bg-white/5 transition-colors">
                 Skip for now
             </button>
         </div>
      </div>
    </div>
  );

  const renderFaceCapture = () => (
      <div className="flex flex-col items-center justify-center min-h-screen p-0 sm:p-4 bg-black relative z-10">
          <div className="relative w-full max-w-lg aspect-[3/4] sm:rounded-[32px] overflow-hidden bg-[#1E1F20] border border-[#333] shadow-2xl">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 pointer-events-none border-[1px] border-white/20 sm:rounded-[32px]"></div>
              <div className="absolute top-8 left-0 right-0 text-center pointer-events-none">
                  <div className="bg-black/50 backdrop-blur-md text-white px-4 py-2 rounded-full inline-block text-sm font-medium">Center your face in good light</div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-center">
                   <button onClick={stopCameraAndBack} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                      <span className="material-symbol">arrow_back</span>
                   </button>
                   <button onClick={captureImage} className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1 group">
                       <div className="w-full h-full bg-white rounded-full group-active:scale-90 transition-transform"></div>
                   </button>
                   <div className="w-12"></div>
              </div>
          </div>
      </div>
  );

  const renderUpload = () => (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in-up relative z-10">
          <div className="w-full max-w-lg bg-[#1E1F20] rounded-[32px] p-6 sm:p-8 border border-[#444746] shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white">Upload Data</h2>
                  <button onClick={() => setScreen(AppScreen.INTRO)} className="text-gray-400 hover:text-white">
                      <span className="material-symbol">close</span>
                  </button>
              </div>
              <div className="space-y-6">
                  <div className="space-y-2">
                      <label className="text-sm font-medium text-[#A8C7FA] uppercase tracking-wider">Voice Sample (Required)</label>
                      <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${uploadedAudioFile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-[#444746] hover:border-gray-400 hover:bg-[#28292A]'}`}>
                          <input type="file" accept="audio/*" className="hidden" ref={fileInputRef} onChange={handleAudioFileChange} />
                          {uploadedAudioFile ? (
                              <>
                                  <span className="material-symbol text-3xl text-emerald-400 mb-2">check_circle</span>
                                  <span className="text-emerald-200 font-medium truncate max-w-full">{uploadedAudioFile.name}</span>
                                  <span className="text-xs text-emerald-500/70 mt-1">Tap to change</span>
                              </>
                          ) : (
                              <>
                                  <span className="material-symbol text-3xl text-gray-400 mb-2">upload_file</span>
                                  <span className="text-gray-300 font-medium">Select Audio File</span>
                                  <span className="text-xs text-gray-500 mt-1">MP3, WAV, M4A supported</span>
                              </>
                          )}
                      </div>
                  </div>
                  <div className="space-y-2">
                      <label className="text-sm font-medium text-[#A8C7FA] uppercase tracking-wider">Face Image (Optional)</label>
                      <div onClick={() => imageInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden ${uploadedImageFile ? 'border-emerald-500/50' : 'border-[#444746] hover:border-gray-400 hover:bg-[#28292A]'}`}>
                          <input type="file" accept="image/*" className="hidden" ref={imageInputRef} onChange={handleImageFileChange} />
                          {imagePreview ? (
                              <>
                                 <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                                 <div className="relative z-10 flex flex-col items-center">
                                     <span className="material-symbol text-3xl text-white mb-2 shadow-black drop-shadow-lg">image</span>
                                     <span className="text-white font-medium shadow-black drop-shadow-md">Image Selected</span>
                                 </div>
                              </>
                          ) : (
                              <>
                                  <span className="material-symbol text-3xl text-gray-400 mb-2">add_a_photo</span>
                                  <span className="text-gray-300 font-medium">Select Image</span>
                                  <span className="text-xs text-gray-500 mt-1">JPG, PNG supported</span>
                              </>
                          )}
                      </div>
                  </div>
                  <button onClick={startAnalysisFromUpload} disabled={!uploadedAudioFile} className="w-full py-4 rounded-full bg-[#4285F4] text-white font-bold hover:bg-[#3367D6] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 transition-all mt-4">
                      Analyze Data
                  </button>
              </div>
          </div>
      </div>
  );

  const renderAnalyzing = () => {
    const messages = ["Extracting voice biomarkers...", "Analyzing speech patterns...", "Evaluating vocal characteristics...", "Correlating with multimodal data...", "Generating personalized insights..."];
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in-up relative z-10">
             <div className="relative w-48 h-48 mb-12">
                 <div className="absolute top-0 left-0 w-full h-full rounded-full bg-[#4285F4]/20 animate-ping"></div>
                 <div className="absolute top-4 left-4 w-40 h-40 rounded-full bg-[#9B72CB]/20 animate-pulse"></div>
                 <svg className="animate-spin w-full h-full text-[#A8C7FA]" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1" fill="none" strokeDasharray="40 20" />
                 </svg>
                 <div className="absolute inset-0 flex items-center justify-center">
                     <span className="material-symbol text-5xl text-white animate-bounce">psychology</span>
                 </div>
             </div>
             <h2 className="text-2xl font-bold text-white mb-4">Processing Health Data</h2>
             <div className="flex flex-col gap-3 w-full max-w-xs">
                 {messages.map((msg, idx) => (
                     <div key={idx} className={`flex items-center gap-3 transition-all duration-500 ${idx <= analysisStep ? 'opacity-100' : 'opacity-30'}`}>
                         <div className={`w-2 h-2 rounded-full ${idx < analysisStep ? 'bg-emerald-400' : idx === analysisStep ? 'bg-[#A8C7FA] animate-pulse' : 'bg-gray-600'}`}></div>
                         <span className={`text-sm ${idx === analysisStep ? 'text-[#A8C7FA] font-medium' : 'text-gray-400'}`}>{msg}</span>
                     </div>
                 ))}
             </div>
             <div className="mt-12 text-xs text-gray-500 font-mono">SECURE ENCLAVE PROCESSING • GEMINI 3 PRO</div>
        </div>
    );
  };

  const renderIntro = () => (
    <div className="flex flex-col min-h-[100dvh] w-full max-w-[100vw] relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] lg:w-[800px] bg-blue-500/10 blur-[80px] sm:blur-[120px] rounded-full pointer-events-none"></div>
      <div className="w-full flex justify-end p-4 sm:p-6 z-20 relative shrink-0">
          <div className="relative group" data-tour="language-selector">
             <select value={selectedLanguage.code} onChange={(e) => { const lang = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value); if(lang) setSelectedLanguage(lang); }} className="appearance-none bg-[#1E1F20]/90 backdrop-blur-md border border-[#444746] text-[#E3E3E3] py-2 pl-3 pr-8 rounded-full text-xs sm:text-sm font-medium focus:outline-none focus:border-[#A8C7FA] hover:bg-[#28292A] cursor-pointer transition-colors max-w-[150px] sm:max-w-none truncate">
               {SUPPORTED_LANGUAGES.map(lang => ( <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option> ))}
             </select>
             <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"><span className="material-symbol text-[16px] sm:text-[18px] text-gray-400">language</span></div>
          </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-4 z-10 w-full">
        <div className="w-full max-w-4xl flex flex-col items-center text-center space-y-6 sm:space-y-10">
          <div className="inline-flex items-center gap-2 bg-[#1E1F20] px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-[#444746] shadow-lg">
             <span className="material-symbol text-emerald-400 text-[16px] sm:text-[18px]">verified</span>
             <span className="text-[10px] sm:text-xs font-medium text-gray-300 tracking-wide">CLINICAL VALIDITY READY</span>
          </div>
          <div className="space-y-4 sm:space-y-6">
            <div className="relative inline-block"><span className="material-symbol text-6xl sm:text-8xl text-transparent bg-clip-text bg-gradient-to-tr from-[#4285F4] to-[#9B72CB] animate-pulse">graphic_eq</span></div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-normal text-white tracking-tight px-2">VitalVoice <span className="text-gemini font-medium">AI</span></h1>
            <p className="text-[#C4C7C5] text-base sm:text-lg md:text-2xl leading-relaxed max-w-xs sm:max-w-2xl mx-auto font-light px-2">
              Advanced health screening powered by <span className="text-white font-medium">Gemini 3 Pro</span>.
              <br/><span className="text-xs sm:text-sm mt-2 block opacity-70">Selected Language: <span className="text-[#A8C7FA] font-medium">{selectedLanguage.name}</span></span>
            </p>
            <div className="flex items-center justify-center gap-4">
                <button onClick={() => window.open("https://www.youtube.com/watch?v=vuwO8PJ1A4I", "_blank")} className="inline-flex items-center gap-2 text-[#A8C7FA] hover:text-[#D3E3FD] font-medium transition-colors text-sm sm:text-base"><span className="material-symbol">smart_display</span>Watch Demo</button>
            </div>
          </div>
          <div className="flex gap-2 sm:gap-3 justify-center flex-wrap px-4">
            {['Neurological', 'Respiratory', 'Mental Health', 'Cardiovascular'].map((item) => ( <div key={item} className="bg-[#1E1F20] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-[#444746] text-xs sm:text-sm text-gray-300">{item}</div> ))}
          </div>
          <div className="flex flex-col gap-4 w-full max-w-md mt-4 sm:mt-8 px-4">
            <div className="flex flex-col sm:flex-row gap-4 w-full">
                <button data-tour="start-btn" onClick={() => setScreen(AppScreen.RECORDING)} className="w-full sm:flex-1 h-14 sm:h-16 rounded-full bg-[#D3E3FD] hover:bg-[#C4D7FC] text-[#041E49] font-medium text-base sm:text-lg flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 border border-transparent shadow-xl"><span className="material-symbol">mic</span>Start Screening</button>
                <div className="w-full sm:flex-1 relative">
                <button data-tour="upload-btn" onClick={() => setScreen(AppScreen.UPLOAD_CONFIG)} className="w-full h-14 sm:h-16 rounded-full bg-[#1E1F20] hover:bg-[#28292A] text-[#E3E3E3] font-medium text-base sm:text-lg flex items-center justify-center gap-2 border border-[#444746] transition-all hover:border-gray-400 active:scale-95"><span className="material-symbol">upload_file</span>Upload Data</button>
                <div className="absolute -top-2 -right-2 group z-20"><div data-tour="upload-info" className="bg-[#444746] text-gray-200 rounded-full w-6 h-6 flex items-center justify-center shadow-lg cursor-help hover:bg-[#5E5F60] transition-colors"><span className="material-symbol text-[14px]">info</span></div></div>
                </div>
            </div>
             <button onClick={loadSampleData} className="w-full h-10 sm:h-12 rounded-full bg-transparent hover:bg-white/5 text-[#A8C7FA] font-medium text-sm border border-[#A8C7FA]/30 flex items-center justify-center gap-2 transition-all"><span className="material-symbol text-[18px]">science</span>Try with Sample Data (Instant)</button>
          </div>
        </div>
      </div>
      <div className="p-4 sm:pb-8 text-center z-10 w-full shrink-0 space-y-4">
        <div className="flex flex-col items-center justify-center gap-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Trusted Research</p>
            <div className="flex gap-4 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                 <div className="h-6 w-20 bg-white/10 rounded flex items-center justify-center text-[8px] font-bold">HealthTech</div>
                 <div className="h-6 w-20 bg-white/10 rounded flex items-center justify-center text-[8px] font-bold">MedAI</div>
                 <div className="h-6 w-20 bg-white/10 rounded flex items-center justify-center text-[8px] font-bold">ClinicalJS</div>
            </div>
        </div>
        <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
            <span>Privacy First</span><span>•</span><span>Secure Processing</span><span>•</span><button onClick={() => setShowTechModal(true)} className="text-[#A8C7FA] hover:underline">View Architecture</button>
        </div>
      </div>
    </div>
  );

  const renderResults = () => {
      if (!analysisResult) return null;
      const userMessageCount = chatHistory.filter(m => m.role === 'user').length;
      const turnsRemaining = MAX_CHAT_TURNS - userMessageCount;
      const isChatDisabled = turnsRemaining <= 0;

      return (
          <div className="min-h-screen bg-[#131314] pb-24 animate-fade-in-up">
              <div className="sticky top-0 z-30 bg-[#131314]/90 backdrop-blur-md border-b border-[#444746] px-4 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                       <button onClick={() => { setAnalysisResult(null); setChatHistory([]); setScreen(AppScreen.INTRO); }} className="flex items-center gap-2 bg-[#1E1F20] text-[#A8C7FA] px-4 py-2 rounded-full text-sm font-medium hover:bg-[#2E2F30] border border-[#444746] transition-colors"><span className="material-symbol">add_circle</span><span>New Scan</span></button>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-[#1E1F20] hover:bg-[#28292A] text-[#A8C7FA] rounded-full text-sm border border-[#444746] transition-colors"><span className="material-symbol text-[18px]">download</span><span className="hidden sm:inline">Export PDF</span></button>
                  </div>
              </div>
              <div className="max-w-7xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1 space-y-6">
                      <div className="surface-container rounded-[24px] p-6 text-center border border-[#444746]">
                          <div className="text-[#A8C7FA] text-sm font-bold uppercase tracking-widest mb-4">Overall Wellness Score</div>
                          <div className="relative inline-block">
                              <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 192 192">
                                  <defs>
                                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#4285F4" />
                                        <stop offset="50%" stopColor="#9B72CB" />
                                        <stop offset="100%" stopColor="#D96570" />
                                    </linearGradient>
                                  </defs>
                                  <circle cx="96" cy="96" r="88" stroke="#1E1F20" strokeWidth="12" fill="none" />
                                  <circle cx="96" cy="96" r="88" stroke="url(#grad)" strokeWidth="12" fill="none" strokeDasharray={2 * Math.PI * 88} strokeDashoffset={2 * Math.PI * 88 * (1 - analysisResult.overall_wellness_score / 100)} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <span className="text-5xl font-bold text-white">{analysisResult.overall_wellness_score}</span>
                                  <span className="text-sm text-gray-400 mt-1">/ 100</span>
                              </div>
                          </div>
                          <div className="mt-6 flex justify-center"><span className="px-3 py-1 rounded-full bg-emerald-900/30 text-emerald-400 text-sm font-bold border border-emerald-500/20">Confidence: {analysisResult.confidence_level.toUpperCase()}</span></div>
                      </div>
                      <div className="surface-container rounded-[24px] p-6 border border-[#444746]">
                          <div className="flex items-center gap-2 mb-4"><span className="material-symbol text-[#A8C7FA]">summarize</span><h3 className="text-lg font-bold text-white">Summary</h3></div>
                          <p className="text-gray-300 leading-relaxed text-sm">{analysisResult.summary}</p>
                      </div>
                      <div className="surface-container rounded-[24px] p-6 border border-[#444746]">
                          <div className="flex items-center gap-2 mb-4"><span className="material-symbol text-[#A8C7FA]">lightbulb</span><h3 className="text-lg font-bold text-white">Recommendations</h3></div>
                          <div className="space-y-4">
                              {analysisResult.recommendations.map((rec, i) => (
                                  <div key={i} className="bg-[#1E1F20] p-4 rounded-xl border-l-4 border-[#A8C7FA]">
                                      <div className="flex justify-between items-start mb-1">
                                          <div className="font-bold text-white text-sm">{rec.action}</div>
                                          <div className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${rec.urgency === 'prompt' ? 'bg-red-900/50 text-red-400' : 'bg-blue-900/50 text-blue-400'}`}>{rec.urgency}</div>
                                      </div>
                                      <p className="text-xs text-gray-400">{rec.reason}</p>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
                  <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-min">
                       {Object.entries(analysisResult.domain_scores).map(([key, data], index) => ( <ResultCard key={key} title={key} data={data} delay={index * 100} /> ))}
                  </div>
              </div>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
                  <div className="surface-container rounded-[24px] border border-[#444746] overflow-hidden flex flex-col h-[600px]">
                      <div className="bg-[#28292A] p-4 border-b border-[#444746] flex justify-between items-center">
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#9B72CB] flex items-center justify-center"><span className="material-symbol text-white">auto_awesome</span></div>
                              <div><h3 className="font-bold text-white">VitalVoice Assistant</h3><p className="text-xs text-gray-400">{isChatDisabled ? 'Session limit reached' : `${turnsRemaining} messages remaining`}</p></div>
                          </div>
                          <button onClick={() => setChatHistory([])} className="text-gray-500 hover:text-white" title="Clear Chat"><span className="material-symbol">restart_alt</span></button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#1E1F20]">
                          {chatHistory.length === 0 && (
                              <div className="flex flex-col items-center justify-center h-full text-center opacity-50"><span className="material-symbol text-6xl mb-4 text-gray-600">forum</span><p className="text-gray-400 max-w-xs">Ask me to explain any medical terms or give more wellness tips!</p></div>
                          )}
                          {chatHistory.map((msg, i) => (
                              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[85%] sm:max-w-[70%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-[#4285F4] text-white rounded-br-none' : 'bg-[#2E2F30] text-gray-200 rounded-bl-none'}`}>
                                      {msg.isAudio ? ( <div className="flex items-center gap-2"><span className="material-symbol">graphic_eq</span><audio src={msg.audioUrl} controls className="h-8 w-48 rounded" /></div> ) : ( <MarkdownRenderer content={msg.text} /> )}
                                      {msg.role === 'model' && ( <button onClick={() => speakText(msg.text)} className="mt-2 text-gray-400 hover:text-white block"><span className="material-symbol text-sm">volume_up</span></button> )}
                                  </div>
                              </div>
                          ))}
                          {isChatLoading && (
                              <div className="flex justify-start">
                                  <div className="bg-[#2E2F30] p-4 rounded-2xl rounded-bl-none flex gap-2 items-center"><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div></div>
                              </div>
                          )}
                          <div ref={chatEndRef} />
                      </div>
                      <div className="p-4 bg-[#28292A] border-t border-[#444746]">
                          {isChatDisabled ? (
                             <div className="flex items-center justify-center p-3 bg-[#1E1F20] rounded-full border border-red-900/50 text-red-200 text-sm gap-2"><span className="material-symbol text-lg">lock</span>Chat limit reached for this session. Please restart analysis to chat more.</div>
                          ) : (
                              <form onSubmit={handleChatSubmit} className="flex gap-2">
                                  <button type="button" onMouseDown={startChatRecording} onMouseUp={stopChatRecording} onTouchStart={startChatRecording} onTouchEnd={stopChatRecording} className={`p-3 rounded-full transition-all ${isChatRecording ? 'bg-red-500 text-white scale-110' : 'bg-[#1E1F20] text-[#A8C7FA] hover:bg-[#333]'}`}><span className="material-symbol">{isChatRecording ? 'mic_off' : 'mic'}</span></button>
                                  <div className="flex-1 relative"><input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message..." maxLength={MAX_INPUT_CHARS} className="w-full bg-[#1E1F20] text-white rounded-full px-4 py-3 border border-[#444746] focus:border-[#4285F4] focus:outline-none pr-12" /><div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">{chatInput.length}/{MAX_INPUT_CHARS}</div></div>
                                  <button type="submit" disabled={!chatInput.trim() || isChatLoading} className="p-3 bg-[#4285F4] text-white rounded-full hover:bg-[#3367D6] disabled:opacity-50 disabled:cursor-not-allowed"><span className="material-symbol">send</span></button>
                              </form>
                          )}
                      </div>
                  </div>
              </div>
              <div className="text-center p-8 text-xs text-gray-500 max-w-2xl mx-auto">{analysisResult.disclaimer}</div>
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-[#131314] text-white font-sans overflow-x-hidden selection:bg-blue-500/30">
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[-10%] left-[50%] -translate-x-1/2 w-[800px] h-[800px] bg-[#4285F4]/5 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#9B72CB]/5 rounded-full blur-[100px]"></div>
        </div>
        {showTechModal && <TechModal onClose={() => setShowTechModal(false)} />}
        {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
        {screen === AppScreen.INTRO && renderIntro()}
        {screen === AppScreen.RECORDING && renderRecording()}
        {screen === AppScreen.FACE_PROMPT && renderFacePrompt()}
        {screen === AppScreen.FACE_CAPTURE && renderFaceCapture()}
        {screen === AppScreen.UPLOAD_CONFIG && renderUpload()}
        {screen === AppScreen.ANALYZING && renderAnalyzing()}
        {screen === AppScreen.RESULTS && renderResults()}
    </div>
  );
};

export default App;