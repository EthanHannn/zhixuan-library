"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ReaderTtsStatus = "idle" | "playing" | "paused";

const TTS_RATE_KEY = "zx_reader_tts_rate";
const TTS_VOICE_KEY = "zx_reader_tts_voice";

function splitForSpeech(text: string, maximumLength = 180) {
  const sentences = text.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    if ((current + trimmed).length <= maximumLength) {
      current += trimmed;
      continue;
    }
    if (current) chunks.push(current);
    if (trimmed.length <= maximumLength) {
      current = trimmed;
      continue;
    }
    for (let offset = 0; offset < trimmed.length; offset += maximumLength) {
      chunks.push(trimmed.slice(offset, offset + maximumLength));
    }
    current = "";
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}

export function useReaderTts(paragraphs: string[]) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<ReaderTtsStatus>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURIState] = useState("");
  const [rate, setRateState] = useState(1);

  const paragraphsRef = useRef(paragraphs);
  const voicesRef = useRef(voices);
  const voiceURIRef = useRef(voiceURI);
  const rateRef = useRef(rate);
  const runIdRef = useRef(0);

  useEffect(() => { paragraphsRef.current = paragraphs; }, [paragraphs]);
  useEffect(() => { voicesRef.current = voices; }, [voices]);
  useEffect(() => { voiceURIRef.current = voiceURI; }, [voiceURI]);
  useEffect(() => { rateRef.current = rate; }, [rate]);

  const stop = useCallback(() => {
    runIdRef.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setStatus("idle");
  }, []);

  useEffect(() => {
    const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    if (!canSpeak) return;

    const refreshVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
      const savedVoice = localStorage.getItem(TTS_VOICE_KEY) || "";
      const preferred = available.find((voice) => voice.voiceURI === savedVoice)
        || available.find((voice) => /^zh(-|_)/i.test(voice.lang))
        || available[0];
      if (preferred) setVoiceURIState((current) => current || preferred.voiceURI);
    };

    const initializationTimer = window.setTimeout(() => {
      setSupported(true);
      const savedRate = Number.parseFloat(localStorage.getItem(TTS_RATE_KEY) || "");
      if (Number.isFinite(savedRate) && savedRate >= 0.6 && savedRate <= 2) setRateState(savedRate);
      refreshVoices();
    }, 0);
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    return () => {
      window.clearTimeout(initializationTimer);
      window.speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
      runIdRef.current += 1;
      window.speechSynthesis.cancel();
    };
  }, []);

  const startSequence = useCallback((requestedIndex: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const availableParagraphs = paragraphsRef.current;
    if (availableParagraphs.length === 0) return;

    const firstIndex = Math.min(Math.max(0, requestedIndex), availableParagraphs.length - 1);
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    window.speechSynthesis.cancel();

    const speakChunk = (paragraphIndex: number, chunkIndex: number) => {
      if (runIdRef.current !== runId) return;
      const currentParagraphs = paragraphsRef.current;
      if (paragraphIndex >= currentParagraphs.length) {
        setStatus("idle");
        return;
      }

      const chunks = splitForSpeech(currentParagraphs[paragraphIndex]);
      const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
      const selectedVoice = voicesRef.current.find((voice) => voice.voiceURI === voiceURIRef.current);
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.lang = selectedVoice?.lang || "zh-CN";
      utterance.rate = rateRef.current;
      utterance.volume = 1;

      utterance.onstart = () => {
        if (runIdRef.current !== runId) return;
        setCurrentIndex(paragraphIndex);
        setStatus("playing");
      };
      utterance.onend = () => {
        if (runIdRef.current !== runId) return;
        if (chunkIndex + 1 < chunks.length) {
          speakChunk(paragraphIndex, chunkIndex + 1);
        } else {
          speakChunk(paragraphIndex + 1, 0);
        }
      };
      utterance.onerror = (event) => {
        if (runIdRef.current !== runId || event.error === "canceled" || event.error === "interrupted") return;
        setStatus("idle");
      };
      window.speechSynthesis.speak(utterance);
    };

    speakChunk(firstIndex, 0);
  }, []);

  const toggle = useCallback((startIndex = currentIndex) => {
    if (!supported) return;
    if (status === "playing") {
      window.speechSynthesis.pause();
      setStatus("paused");
    } else if (status === "paused") {
      window.speechSynthesis.resume();
      setStatus("playing");
    } else {
      startSequence(startIndex);
    }
  }, [currentIndex, startSequence, status, supported]);

  const previous = useCallback(() => startSequence(Math.max(0, currentIndex - 1)), [currentIndex, startSequence]);
  const next = useCallback(() => startSequence(Math.min(paragraphsRef.current.length - 1, currentIndex + 1)), [currentIndex, startSequence]);

  const setRate = useCallback((nextRate: number) => {
    const safeRate = Math.min(2, Math.max(0.6, nextRate));
    rateRef.current = safeRate;
    setRateState(safeRate);
    localStorage.setItem(TTS_RATE_KEY, String(safeRate));
  }, []);

  const setVoiceURI = useCallback((nextVoiceURI: string) => {
    voiceURIRef.current = nextVoiceURI;
    setVoiceURIState(nextVoiceURI);
    localStorage.setItem(TTS_VOICE_KEY, nextVoiceURI);
  }, []);

  return {
    supported,
    status,
    currentIndex,
    voices,
    voiceURI,
    rate,
    toggle,
    startFrom: startSequence,
    previous,
    next,
    stop,
    setRate,
    setVoiceURI,
  };
}
