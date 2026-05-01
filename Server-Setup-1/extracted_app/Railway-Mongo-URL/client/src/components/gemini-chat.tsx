import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, MessageCircle, Sparkles, Volume2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  isTyping?: boolean;
}

export function GeminiFloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const animateTyping = useCallback((fullText: string) => {
    let idx = 0;
    setMessages((prev) => [...prev, { role: "assistant", text: "", isTyping: true }]);
    typewriterRef.current = setInterval(() => {
      idx += 2;
      if (idx >= fullText.length) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", text: fullText, isTyping: false };
          return updated;
        });
        if (typewriterRef.current) clearInterval(typewriterRef.current);
      } else {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", text: fullText.slice(0, idx), isTyping: true };
          return updated;
        });
      }
    }, 15);
  }, []);

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setIsLoading(true);

    try {
      const res = await apiRequest("POST", "/api/gemini-chat", { message: msg });
      const data = await res.json();
      setIsLoading(false);
      if (data.success && data.data?.text) {
        animateTyping(data.data.text);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", text: data.error || "Sorry, I couldn't process that." }]);
      }
    } catch {
      setIsLoading(false);
      setMessages((prev) => [...prev, { role: "assistant", text: "Connection error. Please try again." }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center group"
          data-testid="button-gemini-chat-open"
          title="Ask Gemini AI"
        >
          <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        </button>
      )}

      {isOpen && (
        <div
          className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-[9999] w-[380px] max-w-[calc(100vw-1.5rem)] h-[520px] max-h-[calc(100vh-5rem)] flex flex-col rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden"
          data-testid="panel-gemini-chat"
        >
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <div>
                <h3 className="text-sm font-bold leading-tight">Gemini AI Assistant</h3>
                <p className="text-[10px] opacity-80">Ask anything about your data</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
              data-testid="button-gemini-chat-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
                  <MessageCircle className="w-7 h-7 text-purple-500" />
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">How can I help?</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Ask about sales, orders, inventory, or anything in your system</p>
                <div className="flex flex-col gap-2 w-full">
                  {[
                    "How many sales do we have?",
                    "How many times did I log in today?",
                    "What are the top selling items?",
                    "Show me pending orders",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => { setInput(suggestion); setTimeout(() => inputRef.current?.focus(), 50); }}
                      className="text-xs text-left px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-100 dark:border-gray-700"
                      data-testid={`button-suggestion-${suggestion.slice(0, 10).replace(/\s/g, "-")}`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-blue-500 to-purple-500 text-white rounded-br-sm"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm"
                  }`}
                  data-testid={`chat-message-${msg.role}-${i}`}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-xs text-gray-400 ml-1">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-700 px-3 py-3 bg-white dark:bg-gray-900">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your data..."
                className="flex-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 text-gray-800 dark:text-gray-200 placeholder-gray-400"
                disabled={isLoading}
                data-testid="input-gemini-message"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center disabled:opacity-40 hover:shadow-md transition-all flex-shrink-0"
                data-testid="button-gemini-send"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface VoiceInsightProps {
  position: { x: number; y: number };
  clickedPoint: any;
  onClose: () => void;
}

export function VoiceInsightBubble({ position, clickedPoint, onClose }: VoiceInsightProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showInput, setShowInput] = useState(true);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    onClose();
  };

  const playAudio = () => {
    if (!audioSrc) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(audioSrc);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    setIsPlaying(true);
    audio.play().catch(() => setIsPlaying(false));
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  const askQuestion = async () => {
    if (!question.trim() || isLoading) return;
    setIsLoading(true);
    setShowInput(false);
    setAudioSrc(null);

    try {
      const res = await apiRequest("POST", "/api/voice-insight", { question, clickedPoint });
      const data = await res.json();
      if (data.success && data.data) {
        const responseText = data.data.text || "Here's what I found.";
        setAnswer(responseText);

        if (data.data.audioBase64) {
          const src = `data:audio/wav;base64,${data.data.audioBase64}`;
          setAudioSrc(src);
          try {
            const audio = new Audio(src);
            audioRef.current = audio;
            audio.onended = () => setIsPlaying(false);
            audio.onerror = () => setIsPlaying(false);
            setIsPlaying(true);
            await audio.play();
          } catch {
            setIsPlaying(false);
          }
        }
      } else {
        setAnswer(data.error || "Couldn't get an answer.");
      }
    } catch {
      setAnswer("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") askQuestion();
    if (e.key === "Escape") handleClose();
  };

  const left = Math.max(8, Math.min(position.x, window.innerWidth - 340));
  const top = Math.max(8, Math.min(position.y + 10, window.innerHeight - 280));

  return (
    <div
      className="fixed z-[10000] w-[320px] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      style={{ left, top }}
      data-testid="panel-voice-insight"
    >
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-bold">AI Insight</span>
        </div>
        <button onClick={handleClose} className="p-1 rounded-full hover:bg-white/20" data-testid="button-voice-close">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3">
        {showInput && (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this data point..."
              className="flex-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-400/50 text-gray-800 dark:text-gray-200 placeholder-gray-400"
              data-testid="input-voice-question"
            />
            <button
              onClick={askQuestion}
              disabled={!question.trim()}
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center disabled:opacity-40"
              data-testid="button-voice-ask"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
            <span className="text-xs text-gray-500">Analyzing...</span>
          </div>
        )}

        {answer && (
          <div className="mt-2 text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 rounded-lg p-3" data-testid="text-voice-answer">
            {answer}
          </div>
        )}

        {audioSrc && (
          <button
            onClick={isPlaying ? stopAudio : playAudio}
            className={`mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              isPlaying
                ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
            }`}
            data-testid="button-play-audio"
          >
            {isPlaying ? (
              <><Volume2 className="w-3.5 h-3.5 animate-pulse" /> Stop Audio</>
            ) : (
              <><Volume2 className="w-3.5 h-3.5" /> Play Audio Response</>
            )}
          </button>
        )}

        {clickedPoint && (
          <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded px-2 py-1">
            Context: {typeof clickedPoint === "object" ? Object.entries(clickedPoint).map(([k, v]) => `${k}: ${v}`).join(", ") : String(clickedPoint)}
          </div>
        )}
      </div>
    </div>
  );
}
