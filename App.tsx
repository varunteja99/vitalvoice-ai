import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AppScreen, HealthAnalysis, ChatMessage } from './types';
import { analyzeHealth, chatWithHealthAssistant } from './services/geminiService';
import Waveform from './components/Waveform';
import ResultCard from './components/ResultCard';

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

// Tour Guide Data
const TOUR_STEPS = [
  {
    target: null, // Center
    title: "Welcome to VitalVoice AI",
    content: "This app uses advanced AI to analyze health biomarkers using your voice and face. Let's take a quick tour!"
  },
  {
    target: "start-btn",
    title: "Voice Screening",
    content: "Tap here to begin. You'll be asked to answer a simple question while our AI analyzes your speech patterns."
  },
  {
    target: "upload-btn", 
    title: "Face Scan Feature",
    content: "For higher accuracy, you can opt-in to a face scan. This detects visual signs like fatigue and pallor."
  },
  {
    target: null, // Center
    title: "AI Analysis",
    content: "Powered by Gemini 3 Pro, the app correlates audio and visual data to provide a comprehensive wellness score."
  },
  {
    target: null, // Center
    title: "Privacy & Getting Started",
    content: "Your health data is processed securely and is never stored without your explicit consent. Ready to start?"
  }
];

// Tour Overlay Component
const TourOverlay: React.FC<{ 
  stepIndex: number; 
  onNext: () => void; 
  onPrev: () => void; 
  onSkip: () => void; 
}> = ({ stepIndex, onNext, onPrev, onSkip }) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [windowDimensions, setWindowDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const step = TOUR_STEPS[stepIndex];
  
  // Check if mobile for responsive layout
  const isMobile = windowDimensions.width < 768;

  useLayoutEffect(() => {
    const updatePosition = () => {
      setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
      if (step.target) {
        const el = document.querySelector(`[data-tour="${step.target}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
          setTargetRect(el.getBoundingClientRect());
        } else {
          setTargetRect(null);
        }
      } else {
        setTargetRect(null);
      }
    };

    updatePosition();
    
    const handleScrollOrResize = () => {
        setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
        if (step.target) {
            const el = document.querySelector(`[data-tour="${step.target}"]`);
            if (el) setTargetRect(el.getBoundingClientRect());
        }
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    
    return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [stepIndex]);

  // Determine styles based on screen size
  let tooltipStyle: React.CSSProperties = {
      position: 'fixed',
      zIndex: 101,
  };

  if (isMobile) {
    // Mobile Strategy: Centered Modal with User Requested Dimensions
    tooltipStyle = {
      ...tooltipStyle,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 'calc(100vw - 48px)', // Requested width logic
      minWidth: '340px',          // Requested min-width
      maxWidth: '400px',          // Requested max-width
      margin: 0,
    };
  } else {
    // Desktop Strategy: Float near element or Center
    const PADDING = 20; 
    const MAX_WIDTH = 380;
    const tooltipWidth = Math.min(MAX_WIDTH, windowDimensions.width - (PADDING * 2));
    
    if (targetRect) {
        let left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        left = Math.max(PADDING, Math.min(left, windowDimensions.width - tooltipWidth - PADDING));
        
        const spaceBelow = windowDimensions.height - targetRect.bottom;
        const spaceAbove = targetRect.top;
        const tooltipHeightEst = 240;

        let top: number | undefined;
        let bottom: number | undefined;

        if (spaceBelow >= tooltipHeightEst || spaceBelow > spaceAbove) {
            top = targetRect.bottom + 24;
        } else {
            bottom = windowDimensions.height - targetRect.top + 24;
        }

        tooltipStyle = {
            ...tooltipStyle,
            position: 'absolute',
            width: tooltipWidth,
            left: left,
            top: top,
            bottom: bottom,
        };
    } else {
        // Centered for steps without target on Desktop
        tooltipStyle = {
            ...tooltipStyle,
            position: 'absolute',
            width: tooltipWidth,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
        };
    }
  }

  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const isFirst = stepIndex === 0;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Dimmed Background */}
      <div 
        className="absolute inset-0 transition-all duration-500 ease-in-out"
        style={{
          boxShadow: targetRect 
            ? `0 0 0 9999px rgba(0, 0, 0, 0.8)`
            : `0 0 0 9999px rgba(0, 0, 0, 0.8)`,
          backgroundColor: targetRect ? 'transparent' : 'rgba(0,0,0,0.8)',
          // Spotlight calculation
          top: targetRect ? targetRect.top - 8 : '50%',
          left: targetRect ? targetRect.left - 8 : '50%',
          width: targetRect ? targetRect.width + 16 : 0,
          height: targetRect ? targetRect.height + 16 : 0,
          borderRadius: '16px',
          position: 'absolute'
        }}
      >
          {targetRect && (
              <div className="absolute inset-0 rounded-[16px] ring-2 ring-[#A8C7FA] animate-pulse shadow-[0_0_30px_rgba(168,199,250,0.2)]"></div>
          )}
      </div>

      {/* Tooltip Card */}
      <div 
        className="bg-[#1E1F20] border border-[#444746] rounded-2xl shadow-2xl flex flex-col animate-fade-in-up overflow-hidden"
        style={tooltipStyle}
      >
        <div className="flex flex-col h-full" style={{ padding: '24px' }}> {/* Requested Padding 24px */}
            {/* Header / Steps */}
            <div className="flex justify-between items-start mb-4">
                <div className="bg-[#A8C7FA]/10 text-[#A8C7FA] px-2.5 py-1 rounded text-xs font-bold tracking-wide">
                    STEP {stepIndex + 1} / {TOUR_STEPS.length}
                </div>
            </div>
            
            {/* Content */}
            <div className="mb-6">
                <h3 
                    className="text-xl font-bold text-white mb-3 break-words"
                    style={{ wordWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.3' }}
                >
                    {step.title}
                </h3>
                <p 
                    className="text-[#C4C7C5] text-base leading-relaxed break-words"
                    style={{ wordWrap: 'break-word', whiteSpace: 'normal', overflowWrap: 'break-word' }}
                >
                    {step.content}
                </p>
            </div>

            {/* Footer Navigation */}
            <div className="flex justify-between items-center pt-2 mt-auto">
                {/* Left Button: Skip (Step 1) or Back (Step 2+) */}
                {isFirst ? (
                    <button 
                        onClick={onSkip} 
                        className="text-gray-400 hover:text-white font-medium px-2 py-2 transition-colors text-sm"
                    >
                        Skip
                    </button>
                ) : (
                    <button 
                        onClick={onPrev} 
                        className="text-gray-400 hover:text-white font-medium px-2 py-2 transition-colors text-sm flex items-center gap-1"
                    >
                        Back
                    </button>
                )}

                {/* Pagination Dots (Center) */}
                <div className="flex gap-1.5 mx-4">
                    {TOUR_STEPS.map((_, i) => (
                        <div 
                            key={i} 
                            className={`h-1.5 rounded-full transition-all duration-300 ${i === stepIndex ? 'w-5 bg-[#A8C7FA]' : 'w-1.5 bg-[#444746]'}`}
                        />
                    ))}
                </div>

                {/* Right Button: Next or Get Started */}
                <button 
                    onClick={onNext}
                    className="bg-[#A8C7FA] text-[#041E49] px-6 py-2.5 rounded-full text-sm font-bold hover:bg-[#D3E3FD] transition-colors shadow-lg whitespace-nowrap"
                >
                    {isLast ? "Get Started" : "Next"}
                </button>
            </div>
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
  
  // Tour State
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

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

  const startTour = () => {
    setTourStep(0);
    setShowTour(true);
  };

  const nextTourStep = () => {
    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep(prev => prev + 1);
    } else {
      setShowTour(false);
    }
  };

  const prevTourStep = () => {
    if (tourStep > 0) {
      setTourStep(prev => prev - 1);
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
      
      {/* Tour Overlay */}
      {showTour && (
        <TourOverlay 
          stepIndex={tourStep} 
          onNext={nextTourStep} 
          onPrev={prevTourStep}
          onSkip={() => setShowTour(false)}
        />
      )}

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
            
            {/* Tour Button */}
            <button onClick={startTour} className="inline-flex items-center gap-2 text-[#A8C7FA] hover:text-[#D3E3FD] font-medium transition-colors text-sm sm:text-base">
              <span className="material-symbol">play_circle</span>
              How it works
            </button>
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
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mt-4 sm:mt-8 px-4">
            <button 
              data-tour="start-btn"
              onClick={() => setScreen(AppScreen.RECORDING)}
              className="w-full sm:flex-1 h-14 sm:h-16 rounded-full bg-[#D3E3FD] hover:bg-[#C4D7FC] text-[#041E49] font-medium text-base sm:text-lg flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 border border-transparent"
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

        </div>
      </div>

      {/* Footer */}
      <div className="p-4 sm:pb-8 text-center z-10 w-full shrink-0">
        <p className="text-[10px] sm:text-xs text-gray-600">
          Privacy First • Secure Processing • Clinical Standard
        </p>
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

  const renderAnalyzing = () => (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#131314] p-6 text-center w-full">
      <div className="relative w-24 h-24 sm:w-32 sm:h-32 mb-8 sm:mb-12">
         {/* Custom Spinner */}
         <svg className="animate-spin w-full h-full text-[#A8C7FA]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-10" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <h3 className="text-2xl sm:text-3xl text-white font-normal mb-4">Analyzing Biomarkers</h3>
      <div className="h-8">
        <p className="text-[#A8C7FA] text-base sm:text-lg animate-pulse font-medium px-4">
          {["Processing audio waveform...", "Detecting micro-tremors...", "Analyzing facial syntax...", "Correlating multimodal data...", "Generating insights..."][analysisStep % 5]}
        </p>
      </div>
    </div>
  );

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
             <button onClick={() => setScreen(AppScreen.INTRO)} className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full hover:bg-[#28292A] text-xs sm:text-sm font-medium text-gray-300">
               New Scan
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
              <div className="bg-[#1E1F20] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 border border-[#444746] relative overflow-hidden text-center lg:text-left h-full">
                <div className="flex flex-col items-center lg:items-start z-10 relative">
                   <div className="text-7xl sm:text-8xl md:text-9xl font-medium text-white tracking-tighter mb-2">
                     {analysisResult.overall_wellness_score}
                   </div>
                   <span className="text-xs sm:text-sm font-bold text-[#A8C7FA] uppercase tracking-widest mb-4 sm:mb-6 block">Wellness Score</span>
                   <p className="text-[#C4C7C5] text-base sm:text-lg leading-relaxed">
                     {analysisResult.summary}
                   </p>
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
          
          <div className="mt-8 sm:mt-12 text-center pb-20 md:pb-0">
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