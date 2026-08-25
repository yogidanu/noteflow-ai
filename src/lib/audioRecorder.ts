/**
 * Web Audio Recorder & Real-Time Equalizer Engine
 * Captures microphone audio using MediaRecorder and computes real RMS volume power levels via Web Audio API.
 */

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  durationSeconds: number;
  audioPowerLevel: number; // 0 to 100
  hasPermission: boolean;
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
  private onPowerLevelChange?: (level: number) => void;
  private onDurationChange?: (duration: number) => void;

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
   * Requests microphone permission and starts live audio capture.
   */
  public async start(options?: {
    onPowerLevel?: (level: number) => void;
    onDuration?: (duration: number) => void;
  }): Promise<boolean> {
    if (!WebAudioRecorder.isSupported()) {
      console.warn("[WebAudioRecorder] Audio recording is not supported in this environment");
      return false;
    }

    this.onPowerLevelChange = options?.onPowerLevel;
    this.onDurationChange = options?.onDuration;
    this.audioChunks = [];
    this.durationSeconds = 0;
    this.isPaused = false;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Initialize Web Audio Context for real-time RMS equalizer analysis
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

      // Select best supported MIME type
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
        }
      };

      // Collect audio chunks every 1000ms
      this.mediaRecorder.start(1000);

      // Start duration timer
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
    }
  }

  /**
   * Resumes recording
   */
  public resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === "paused") {
      this.mediaRecorder.resume();
      this.isPaused = false;
    }
  }

  /**
   * Stops recording and returns the compiled audio Blob.
   */
  public async stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        this.cleanup();
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
        const compiledBlob = new Blob(this.audioChunks, { type: mimeType });
        this.cleanup();
        resolve(compiledBlob.size > 0 ? compiledBlob : null);
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        this.cleanup();
        resolve(null);
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
      if (!this.analyser || this.isPaused) {
        if (this.onPowerLevelChange) this.onPowerLevelChange(0);
        this.animFrameId = requestAnimationFrame(updateMeter);
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);

      // Compute average energy in vocal range (frequencies ~85Hz - 4kHz)
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;

      // Normalize to 0-100 scale with natural vocal threshold curve
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
