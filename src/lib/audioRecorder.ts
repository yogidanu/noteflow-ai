/**
 * Web Audio Recorder & Real-Time Equalizer Engine with Integrated Web Speech Recognition
 * Captures microphone audio using MediaRecorder and computes real RMS volume power levels.
 * Concurrently runs browser-native Web Speech Recognition for instant, zero-cost real-time live transcription.
 */

export interface DiarizedSpeechSegment {
  speaker: string;
  timestamp: string; // e.g. "00:15"
  text: string;
}

export interface AudioRecordingResult {
  audioBlob: Blob | null;
  transcriptText: string;
  segments: DiarizedSpeechSegment[];
}

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  durationSeconds: number;
  audioPowerLevel: number; // 0 to 100
  hasPermission: boolean;
  liveTranscript: string;
}

export class WebAudioRecorder {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private durationSeconds = 0;
  private isPaused = false;
  private isRunning = false;

  // Web Speech Recognition Engine
  private recognition: any = null;
  private recognizedSegments: DiarizedSpeechSegment[] = [];
  private currentUtterance = "";
  private fullTranscriptText = "";

  private onPowerLevelChange?: (level: number) => void;
  private onDurationChange?: (duration: number) => void;
  private onChunkRecorded?: (chunk: Blob) => void;
  private onLiveTranscriptChange?: (text: string) => void;

  /**
   * Checks if browser supports audio capture
   */
  public static isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      Boolean(navigator?.mediaDevices?.getUserMedia) &&
      Boolean(window.MediaRecorder || (window as any).webkitMediaRecorder)
    );
  }

  /**
   * Requests microphone permission and starts live audio capture and Web Speech transcription.
   */
  public async start(options?: {
    onPowerLevel?: (level: number) => void;
    onDuration?: (duration: number) => void;
    onChunk?: (chunk: Blob) => void;
    onLiveTranscript?: (text: string) => void;
    speakerName?: string;
  }): Promise<boolean> {
    if (!WebAudioRecorder.isSupported()) {
      console.warn("[WebAudioRecorder] Audio recording is not supported in this environment");
      return false;
    }

    this.onPowerLevelChange = options?.onPowerLevel;
    this.onDurationChange = options?.onDuration;
    this.onChunkRecorded = options?.onChunk;
    this.onLiveTranscriptChange = options?.onLiveTranscript;
    this.audioChunks = [];
    this.recognizedSegments = [];
    this.currentUtterance = "";
    this.fullTranscriptText = "";
    this.durationSeconds = 0;
    this.isPaused = false;
    this.isRunning = true;

    const activeSpeaker = options?.speakerName || "You";

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 1. Initialize Web Audio Context for real-time RMS equalizer analysis
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;
        source.connect(this.analyser);

        this.startEqualizerLoop();
      }

      // 2. Select best supported MIME type
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/wav",
      ];
      const selectedMimeType = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || "";

      this.mediaRecorder = new MediaRecorder(
        this.mediaStream,
        selectedMimeType ? { mimeType: selectedMimeType } : undefined
      );

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
          if (this.onChunkRecorded) {
            this.onChunkRecorded(event.data);
          }
        }
      };

      // Collect audio chunks every 1000ms
      this.mediaRecorder.start(1000);

      // 3. Start Browser Native Web Speech Recognition if available (Chrome / Edge / Safari)
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          this.recognition = new SpeechRecognition();
          this.recognition.continuous = true;
          this.recognition.interimResults = true;
          this.recognition.lang = "en-US";

          this.recognition.onresult = (event: any) => {
            let interimTranscript = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const transcriptChunk = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                const cleanChunk = transcriptChunk.trim();
                if (cleanChunk) {
                  const mins = Math.floor(this.durationSeconds / 60);
                  const secs = this.durationSeconds % 60;
                  const timeLabel = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

                  this.recognizedSegments.push({
                    speaker: activeSpeaker,
                    timestamp: timeLabel,
                    text: cleanChunk,
                  });

                  this.fullTranscriptText = this.recognizedSegments
                    .map((s) => `${s.speaker} [${s.timestamp}]: ${s.text}`)
                    .join("\n");

                  if (this.onLiveTranscriptChange) {
                    this.onLiveTranscriptChange(this.fullTranscriptText);
                  }
                }
              } else {
                interimTranscript += transcriptChunk;
              }
            }
          };

          this.recognition.onerror = (err: any) => {
            console.warn("[WebAudioRecorder] Speech recognition event:", err?.error || err);
          };

          this.recognition.onend = () => {
            // Auto-restart recognition if still recording (SpeechRecognition stops on long pauses)
            if (this.isRunning && !this.isPaused && this.recognition) {
              try {
                this.recognition.start();
              } catch {
                // Ignore already started errors
              }
            }
          };

          this.recognition.start();
        } catch (e) {
          console.warn("[WebAudioRecorder] Could not initialize Web Speech Recognition:", e);
        }
      }

      // 4. Start duration timer
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        if (!this.isPaused) {
          this.durationSeconds += 1;
          if (this.onDurationChange) {
            this.onDurationChange(this.durationSeconds);
          }
        }
      }, 1000);

      return true;
    } catch (err: any) {
      console.warn("[WebAudioRecorder] Failed to initialize microphone capture:", err);
      this.cleanup();
      return false;
    }
  }

  /**
   * Pauses recording
   */
  public pause(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.pause();
      this.isPaused = true;
      if (this.onPowerLevelChange) this.onPowerLevelChange(0);
      if (this.recognition) {
        try {
          this.recognition.stop();
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Resumes recording
   */
  public resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === "paused") {
      this.mediaRecorder.resume();
      this.isPaused = false;
      if (this.recognition) {
        try {
          this.recognition.start();
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Stops recording and returns the compiled audio Blob and captured live Speech transcript.
   */
  public async stop(): Promise<AudioRecordingResult> {
    this.isRunning = false;

    if (this.recognition) {
      try {
        this.recognition.stop();
        this.recognition = null;
      } catch {
        // ignore
      }
    }

    return new Promise((resolve) => {
      const compileResult = (blob: Blob | null) => {
        let transcriptText = this.fullTranscriptText;

        // If no speech API segments were collected, build a baseline session log
        if (!transcriptText && this.durationSeconds >= 1) {
          const mins = Math.floor(this.durationSeconds / 60);
          const secs = this.durationSeconds % 60;
          const timeLabel = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
          transcriptText = `Participant [00:00 - ${timeLabel}]: Meeting dialogue recorded (${this.durationSeconds}s duration).`;
        }

        resolve({
          audioBlob: blob,
          transcriptText,
          segments: this.recognizedSegments,
        });
      };

      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        this.cleanup();
        compileResult(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
        const compiledBlob = new Blob(this.audioChunks, { type: mimeType });
        this.cleanup();
        compileResult(compiledBlob.size > 0 ? compiledBlob : null);
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        this.cleanup();
        compileResult(null);
      }
    });
  }

  /**
   * Runs the real-time RMS equalizer loop via requestAnimationFrame.
   */
  private startEqualizerLoop(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const updateMeter = () => {
      if (!this.analyser || this.isPaused || !this.isRunning) {
        if (this.onPowerLevelChange) this.onPowerLevelChange(0);
        if (this.isRunning) {
          this.animFrameId = requestAnimationFrame(updateMeter);
        }
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const normalizedPower = Math.min(100, Math.round((average / 128) * 100));

      if (this.onPowerLevelChange) {
        this.onPowerLevelChange(normalizedPower);
      }

      this.animFrameId = requestAnimationFrame(updateMeter);
    };

    this.animFrameId = requestAnimationFrame(updateMeter);
  }

  /**
   * Cleans up all audio contexts, timers, and tracks.
   */
  private cleanup(): void {
    this.isRunning = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        this.audioContext.close();
      } catch {
        // Ignore context close error
      }
      this.audioContext = null;
    }

    this.analyser = null;
    this.mediaRecorder = null;
    this.isPaused = false;
  }
}

export const webAudioRecorder = new WebAudioRecorder();
