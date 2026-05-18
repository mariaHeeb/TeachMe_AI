export class VoiceTurnRecorder {
  constructor(options = {}) {
    this.onStatus = options.onStatus || (() => {});
    this.onMeter = options.onMeter || (() => {});
    this.onTurn = options.onTurn || (() => {});
    this.onError = options.onError || (() => {});

    this.audioContext = null;
    this.stream = null;
    this.source = null;
    this.processor = null;

    this.isListening = false;
    this.isCalibrating = false;
    this.isProcessing = false;
    this.isMuted = false;

    this.calibrationStartedAt = 0;
    this.calibrationRmsValues = [];
    this.calibrationPeakValues = [];

    this.noiseRms = 0.004;
    this.noisePeak = 0.018;
    this.gateRms = 0.011;
    this.gatePeak = 0.030;

    this.sensitivityMode = 'balanced';

    this.currentBuffers = [];
    this.preRollBuffers = [];
    this.turnActive = false;
    this.turnStartedAt = 0;
    this.lastVoiceAt = 0;
    this.lastMeterAt = 0;
  }

  async start() {
    if (this.isListening) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.processor.onaudioprocess = event => this.handleAudio(event);

      this.isListening = true;
      this.isCalibrating = true;
      this.isProcessing = false;
      this.turnActive = false;
      this.currentBuffers = [];
      this.preRollBuffers = [];
      this.calibrationRmsValues = [];
      this.calibrationPeakValues = [];
      this.calibrationStartedAt = performance.now();

      this.onStatus({
        mode: 'calibrating',
        title: 'Listening — calibrating room noise',
        detail: 'Stay quiet for about one second, then speak naturally.'
      });
    } catch (error) {
      this.onError({
        code: 'MIC_START_FAILED',
        message: `${error.name || 'Microphone error'}: ${error.message || error}`
      });
    }
  }

  stop() {
    this.isListening = false;
    this.isCalibrating = false;
    this.isProcessing = false;
    this.turnActive = false;
    this.currentBuffers = [];
    this.preRollBuffers = [];

    if (this.processor) {
      this.processor.disconnect();
    }

    if (this.source) {
      this.source.disconnect();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    this.processor = null;
    this.source = null;
    this.stream = null;
    this.audioContext = null;

    this.onStatus({
      mode: 'idle',
      title: 'Paused — press the microphone',
      detail: 'The microphone is stopped.'
    });
  }

  mute(value) {
    this.isMuted = Boolean(value);
  }

  setSensitivity(mode) {
    this.sensitivityMode = mode || 'balanced';
    this.recalculateGate();
  }

  async forceFinish() {
    if (this.turnActive && this.currentBuffers.length) {
      await this.finishTurn('manual');
    }
  }

  handleAudio(event) {
    if (!this.isListening || this.isProcessing || this.isMuted) return;

    const input = event.inputBuffer.getChannelData(0);
    const chunk = new Float32Array(input);
    const metrics = this.calculateMetrics(chunk);
    const now = performance.now();

    if (this.isCalibrating) {
      this.calibrationRmsValues.push(metrics.rms);
      this.calibrationPeakValues.push(metrics.peak);

      this.updateMeter(metrics, 'calibrating');

      if (now - this.calibrationStartedAt >= 900) {
        this.finishCalibration();
      }

      return;
    }

    const hasVoice = this.detectVoice(metrics);

    this.updateMeter(metrics, hasVoice ? 'voice detected' : 'listening');

    if (!this.turnActive) {
      this.preRollBuffers.push(chunk);

      const maxPreRoll = Math.ceil((this.audioContext.sampleRate / chunk.length) * 0.7);

      while (this.preRollBuffers.length > maxPreRoll) {
        this.preRollBuffers.shift();
      }

      if (hasVoice) {
        this.turnActive = true;
        this.turnStartedAt = now;
        this.lastVoiceAt = now;
        this.currentBuffers = this.preRollBuffers.slice();
        this.currentBuffers.push(chunk);

        this.onStatus({
          mode: 'capturing',
          title: 'Capturing your sentence',
          detail: 'Speak normally. Students answer after you pause.'
        });
      }

      return;
    }

    this.currentBuffers.push(chunk);

    if (hasVoice) {
      this.lastVoiceAt = now;
    }

    const silenceMs = now - this.lastVoiceAt;
    const turnMs = now - this.turnStartedAt;

    if ((silenceMs > 1050 && turnMs > 450) || turnMs > 16000) {
      this.finishTurn(silenceMs > 1050 ? 'pause' : 'timeout');
    }
  }

  finishCalibration() {
    this.isCalibrating = false;

    this.noiseRms = percentile(this.calibrationRmsValues, 0.70) || 0.004;
    this.noisePeak = percentile(this.calibrationPeakValues, 0.70) || 0.018;

    this.recalculateGate();

    this.onStatus({
      mode: 'listening',
      title: 'Listening — natural conversation mode',
      detail: 'Ask a short question or explain a concept. Students react after your pause.'
    });
  }

  recalculateGate() {
    let rmsMultiplier = 2.6;
    let minRms = 0.008;
    let peakMultiplier = 1.55;
    let minPeak = 0.026;

    if (this.sensitivityMode === 'sensitive') {
      rmsMultiplier = 1.85;
      minRms = 0.0055;
      peakMultiplier = 1.25;
      minPeak = 0.019;
    }

    if (this.sensitivityMode === 'quiet') {
      rmsMultiplier = 3.6;
      minRms = 0.013;
      peakMultiplier = 2.0;
      minPeak = 0.036;
    }

    this.gateRms = Math.max(minRms, this.noiseRms * rmsMultiplier);
    this.gatePeak = Math.max(minPeak, this.noisePeak * peakMultiplier);
  }

  detectVoice(metrics) {
    const dynamicHit = metrics.rms > this.gateRms && metrics.peak > this.gatePeak;
    const obviousSpeech = metrics.rms > 0.026 && metrics.peak > 0.052;

    return dynamicHit || obviousSpeech;
  }

  async finishTurn(reason) {
    if (this.isProcessing || !this.currentBuffers.length || !this.audioContext) return;

    this.isProcessing = true;
    this.turnActive = false;
    this.preRollBuffers = [];

    this.onStatus({
      mode: 'processing',
      title: 'Thinking — sending one complete sentence',
      detail: `Captured teacher audio after ${reason}.`
    });

    const sampleRate = this.audioContext.sampleRate;
    const audioBlob = encodeWav(this.currentBuffers, sampleRate);

    this.currentBuffers = [];

    if (audioBlob.size < 1500) {
      this.isProcessing = false;

      this.onStatus({
        mode: 'listening',
        title: 'Listening — no clear sentence captured',
        detail: 'Try speaking a little closer to the microphone.'
      });

      return;
    }

    try {
      await this.onTurn({
        audioBlob,
        sampleRate,
        reason
      });
    } finally {
      this.isProcessing = false;
    }
  }

  calculateMetrics(buffer) {
    let sum = 0;
    let peak = 0;

    for (let i = 0; i < buffer.length; i += 1) {
      const value = Math.abs(buffer[i]);

      sum += value * value;

      if (value > peak) {
        peak = value;
      }
    }

    return {
      rms: Math.sqrt(sum / buffer.length),
      peak
    };
  }

  updateMeter(metrics, label) {
    const now = performance.now();

    if (now - this.lastMeterAt < 120) return;

    this.lastMeterAt = now;

    this.onMeter({
      label,
      volume: metrics.rms,
      peak: metrics.peak,
      gate: this.gateRms
    });
  }
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };

    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function encodeWav(buffers, sampleRate) {
  const totalLength = buffers.reduce((total, buffer) => total + buffer.length, 0);
  const samples = new Float32Array(totalLength);

  let offset = 0;

  for (const buffer of buffers) {
    samples.set(buffer, offset);
    offset += buffer.length;
  }

  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(arrayBuffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);

  writeAscii(view, 8, 'WAVE');

  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);

  writeAscii(view, 36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  let position = 44;

  for (let i = 0; i < samples.length; i += 1, position += 2) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(position, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return new Blob([view], {
    type: 'audio/wav'
  });
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function percentile(values, p) {
  if (!values.length) return 0;

  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));

  return sorted[index];
}