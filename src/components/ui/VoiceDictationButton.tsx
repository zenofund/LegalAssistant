import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Tooltip } from './Tooltip';
import { useToast } from './Toast';
import { supabase } from '../../lib/supabase';
import type { UserProfile } from '../../types/database';

interface VoiceDictationButtonProps {
  onTranscriptionComplete: (text: string) => void;
  userProfile: UserProfile | null;
  disabled?: boolean;
  className?: string;
}

type RecordingState = 'idle' | 'recording' | 'transcribing' | 'error';

interface PlanConfig {
  canRecord: boolean;
  maxDuration: number;
  buttonColor: string;
  buttonHoverColor: string;
  iconColor: string;
}

export function VoiceDictationButton({
  onTranscriptionComplete,
  userProfile,
  disabled = false,
  className
}: VoiceDictationButtonProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSoundTimeRef = useRef<number>(Date.now());

  const { showError, showWarning, showSuccess } = useToast();

  const getPlanConfig = (): PlanConfig => {
    const tier = userProfile?.subscription?.plan?.tier || 'free';

    const configs: Record<string, PlanConfig> = {
      free: {
        canRecord: false,
        maxDuration: 0,
        buttonColor: 'bg-gray-300 dark:bg-gray-600',
        buttonHoverColor: 'hover:bg-gray-400 dark:hover:bg-gray-500',
        iconColor: 'text-gray-600 dark:text-gray-300'
      },
      pro: {
        canRecord: true,
        maxDuration: 10,
        buttonColor: 'bg-blue-500 dark:bg-blue-600',
        buttonHoverColor: 'hover:bg-blue-600 dark:hover:bg-blue-700',
        iconColor: 'text-white'
      },
      enterprise: {
        canRecord: true,
        maxDuration: 20,
        buttonColor: 'bg-amber-500 dark:bg-amber-600',
        buttonHoverColor: 'hover:bg-amber-600 dark:hover:bg-amber-700',
        iconColor: 'text-white'
      }
    };

    return configs[tier] || configs.free;
  };

  const planConfig = getPlanConfig();

  const analyzeAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedLevel = average / 255;
    setAudioLevel(normalizedLevel);

    const VOICE_THRESHOLD = 0.02;
    if (normalizedLevel > VOICE_THRESHOLD) {
      lastSoundTimeRef.current = Date.now();
    }

    animationFrameRef.current = requestAnimationFrame(analyzeAudioLevel);
  };

  const startRecording = async () => {
    if (!planConfig.canRecord) {
      showWarning(
        'Upgrade Required',
        'Voice dictation is available only on Pro and Enterprise plans. Upgrade to unlock.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });

      streamRef.current = stream;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      analyzeAudioLevel();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await transcribeAudio(audioBlob);

        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        analyserRef.current = null;
      };

      mediaRecorder.start();
      setRecordingState('recording');
      setRecordingDuration(0);
      lastSoundTimeRef.current = Date.now();

      let duration = 0;
      timerRef.current = setInterval(() => {
        duration += 0.1;
        setRecordingDuration(duration);

        if (duration >= planConfig.maxDuration) {
          stopRecording();
        }
      }, 100);

      const SILENCE_THRESHOLD = 2000;
      silenceTimerRef.current = setInterval(() => {
        const timeSinceLastSound = Date.now() - lastSoundTimeRef.current;
        if (timeSinceLastSound >= SILENCE_THRESHOLD) {
          stopRecording();
        }
      }, 100);

    } catch (error: any) {
      console.error('Error starting recording:', error);

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        showError('Permission Denied', 'Please allow microphone access to use voice dictation.');
      } else if (error.name === 'NotFoundError') {
        showError('No Microphone', 'No microphone was found. Please connect a microphone and try again.');
      } else {
        showError('Recording Failed', 'Failed to start recording. Please try again.');
      }

      setRecordingState('error');
      setTimeout(() => setRecordingState('idle'), 2000);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setRecordingState('transcribing');

    try {
      // Get the current authenticated user's session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          body: formData
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Transcription failed');
      }

      const data = await response.json();

      if (data.text && data.text.trim()) {
        onTranscriptionComplete(data.text.trim());
        showSuccess('Transcription Complete', 'Your voice has been converted to text.');
      } else {
        showWarning('No Speech Detected', 'No speech was detected in the recording. Please try again.');
      }

      setRecordingState('idle');
      setRecordingDuration(0);
      setAudioLevel(0);

    } catch (error: any) {
      console.error('Transcription error:', error);

      if (error.message.includes('Authentication required')) {
        showError('Authentication Error', 'Please sign in again to use voice dictation.');
      } else if (error.message.includes('PLAN_LIMIT')) {
        showError('Upgrade Required', 'Voice transcription requires a Pro or Enterprise plan.');
      } else if (error.message.includes('Unauthorized')) {
        showError('Authentication Error', 'Your session has expired. Please sign in again.');
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        showError('Network Error', 'Failed to connect to transcription service. Please check your connection.');
      } else {
        showError('Transcription Failed', 'Failed to transcribe audio. Please try again.');
      }

      setRecordingState('error');
      setTimeout(() => {
        setRecordingState('idle');
        setRecordingDuration(0);
        setAudioLevel(0);
      }, 2000);
    }
  };

  const handleClick = () => {
    if (disabled) return;

    if (recordingState === 'recording') {
      stopRecording();
    } else if (recordingState === 'idle') {
      startRecording();
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (silenceTimerRef.current) {
        clearInterval(silenceTimerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const getTooltipText = () => {
    const tier = userProfile?.subscription?.plan?.tier || 'free';

    if (tier === 'free') {
      return 'Voice dictation (Pro/Enterprise only)';
    } else if (tier === 'pro') {
      return 'Dictate (up to 10 seconds)';
    } else {
      return 'Dictate (up to 20 seconds)';
    }
  };

  const remainingTime = planConfig.maxDuration - recordingDuration;
  const progressPercentage = (recordingDuration / planConfig.maxDuration) * 100;

  return (
    <div className="relative">
      <Tooltip content={getTooltipText()} position="top">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled || recordingState === 'transcribing'}
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center transition-all relative overflow-hidden",
            recordingState === 'idle' && planConfig.buttonColor,
            recordingState === 'idle' && planConfig.buttonHoverColor,
            recordingState === 'recording' && "bg-red-500 hover:bg-red-600 animate-pulse",
            recordingState === 'transcribing' && "bg-blue-500",
            recordingState === 'error' && "bg-red-500",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          aria-label={recordingState === 'recording' ? 'Stop Recording' : 'Start Voice Dictation'}
        >
          {recordingState === 'recording' && (
            <motion.div
              className="absolute inset-0 bg-red-600/30"
              style={{
                clipPath: `inset(0 ${100 - progressPercentage}% 0 0)`
              }}
              animate={{
                opacity: [0.5, 0.8, 0.5]
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          )}

          <AnimatePresence mode="wait">
            {recordingState === 'transcribing' ? (
              <motion.div
                key="transcribing"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Loader2 className="h-4 w-4 text-white animate-spin" />
              </motion.div>
            ) : recordingState === 'recording' ? (
              <motion.div
                key="recording"
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: 1
                }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{
                  scale: {
                    duration: 0.8,
                    repeat: Infinity,
                    ease: "easeInOut"
                  },
                  opacity: { duration: 0.15 }
                }}
                className="relative"
              >
                <Square className="h-4 w-4 text-white fill-white" />
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: recordingState === 'error' ? [1, 1.2, 1] : 1,
                  opacity: 1
                }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Mic className={cn("h-4 w-4", planConfig.iconColor)} />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </Tooltip>

      <AnimatePresence>
        {recordingState === 'recording' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-800 text-white px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap text-xs font-medium z-50"
          >
            <div className="flex items-center space-x-2">
              <div
                className="w-2 h-2 rounded-full bg-red-500"
                style={{
                  opacity: 0.5 + (audioLevel * 0.5)
                }}
              />
              <span>{remainingTime.toFixed(1)}s</span>
            </div>
          </motion.div>
        )}

        {recordingState === 'transcribing' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap text-xs font-medium z-50"
          >
            Transcribing...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
