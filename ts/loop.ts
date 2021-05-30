import { SampleSource } from "./sampleSource";

export class Loop {
  private static maxHeaderS: number = 5.0;
  private static maxFooterS: number = 5.0;

  readonly audioCtx: AudioContext;
  private sampleSource: SampleSource;

  // State data
  private recordUntil: number = 0;
  private isFinalized: boolean = false;

  // Sample data
  private sampleStartS: number;
  private recordingStartS: number;
  private recordingEndS: number;
  private sampleLengthS: number = 0;
  private sampleList: Float32Array[] = [];

  // Buffer data
  private audioBuffer: AudioBuffer = null;
  private source: AudioBufferSourceNode = null;
  private bodyS: number = undefined;

  constructor(sampleSource: SampleSource) {
    this.sampleSource = sampleSource;
    this.audioCtx = sampleSource.audioCtx;
    this.sampleSource.setListener((samples: Float32Array, endTimeS: number) => {
      this.handleSamples(samples, endTimeS);
    });
  }

  nextLoop(): Loop {
    const result = new Loop(this.sampleSource);
    for (const s of this.sampleList) {
      result.rollSamples(s);
    }
    return result;
  }

  getBodyS() {
    if (!this.bodyS) {
      throw new Error("Loop is not complete.");
    }
    return this.bodyS;
  }

  getPlayLengthS() {
    if (!this.bodyS) {
      throw new Error("Loop is not complete.");
    }
    return this.bodyS + Loop.maxFooterS;
  }

  startRecording(timestamp: number) {
    console.log(`startRecording @ ${this.audioCtx.currentTime}`);
    if (this.recordUntil > 0) {
      throw new Error("Already recording.");
    }
    this.recordUntil = Infinity;
    this.recordingStartS = timestamp;
  }

  private fillFromSamples(sampleIndex: number) {
    const headerStartS = this.recordingStartS - Loop.maxHeaderS;
    // Offset into buffer measured in sample points to where this sample starts
    let bufferStart = Math.round((this.sampleStartS - headerStartS) * this.audioCtx.sampleRate);
    for (let i = 0; i < sampleIndex; ++i) {
      bufferStart += this.sampleList[i].length;
    }
    const buffer: Float32Array = this.audioBuffer.getChannelData(0);
    const sample: Float32Array = this.sampleList[sampleIndex];
    let numFilled = 0;
    for (let i = 0; i < sample.length; ++i) {
      const targetOffset = i + bufferStart;
      if (targetOffset >= 0 && targetOffset < buffer.length) {
        buffer[targetOffset] = sample[i];
        ++numFilled;
      }
    }
  }

  stopRecording(timestamp: number) {
    console.log(`Stop recording; sample list length: ${this.sampleList.length}`);
    if (this.isFinalized) {
      throw new Error("Already finalized");
    }
    this.recordUntil = timestamp + Loop.maxFooterS;

    // The buffer for the AudioBufferSourceNode can be modified
    // after the recording has stopped.  So, at this point we just
    // create the entire audio buffer and dump the tail samples into it as
    // they arrive. 
    this.bodyS = timestamp - this.recordingStartS;
    const loopLengthS = this.bodyS + Loop.maxHeaderS + Loop.maxFooterS;
    const loopLengthSamples = loopLengthS * this.audioCtx.sampleRate;

    this.audioBuffer = this.audioCtx.createBuffer(
      1, loopLengthSamples, this.audioCtx.sampleRate);
    for (let i = 0; i < this.sampleList.length; ++i) {
      this.fillFromSamples(i);
    }
    this.addCanvas();
  }

  startSample(timestamp: number) {
    console.log(`Start sample: ${this.maxOfArray(this.audioBuffer.getChannelData(0))}`);
    const currentTime = this.audioCtx.currentTime;
    this.source = this.audioCtx.createBufferSource();
    this.source.buffer = this.audioBuffer;
    this.source.connect(this.audioCtx.destination);
    const determinant = (timestamp - Loop.maxHeaderS) - currentTime;
    if (determinant >= 0) {
      // Start is in the future.
      this.source.start(timestamp - Loop.maxHeaderS);
    } else {
      // Start is in the past.
      this.source.start(currentTime, -determinant);
    }
  }

  finalize() {
    for (let i = 0; i < this.sampleList.length; ++i) {
      this.fillFromSamples(i);
    }
    this.isFinalized = true;
  }

  private maxOfArray(a: Float32Array) {
    let m = a[0];
    for (const x of a) {
      m = Math.max(m, x);
    }
    return m;
  }

  private rollSamples(samples: Float32Array) {
    // We have not started recording.  Keep a rolling buffer.
    const samplesLengthS = samples.length / this.audioCtx.sampleRate;
    this.sampleList.push(samples.slice());
    this.sampleLengthS += samplesLengthS;
    while (true) {
      const firstBufferLengthS =
        this.sampleList[0].length / this.audioCtx.sampleRate;
      if (this.sampleLengthS - firstBufferLengthS < Loop.maxHeaderS) {
        break;
      }
      this.sampleList.shift();
      this.sampleLengthS -= firstBufferLengthS;
      this.sampleStartS += firstBufferLengthS;
    }
  }

  private handleSamples(samples: Float32Array, endTimeS: number) {
    const samplesLengthS = samples.length / this.audioCtx.sampleRate;
    if (!this.sampleStartS) {
      this.sampleStartS = endTimeS - samplesLengthS;
    }
    if (this.recordUntil === 0) {
      this.rollSamples(samples);
    } else if (endTimeS < this.recordUntil) {
      // Recording has started.  Fill the samples as they arrive.
      this.sampleList.push(samples);
      this.sampleLengthS += samplesLengthS;
      if (this.audioBuffer) {
        this.fillFromSamples(this.sampleList.length - 1);
      }
    } else if (!this.isFinalized) {
      this.finalize();
    }
  }

  private addCanvas() {
    const body = document.getElementsByTagName('body')[0];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 500;
    canvas.height = 50;
    body.appendChild(canvas);

    const scale = 100;

    let i = Math.round(Loop.maxHeaderS * this.audioCtx.sampleRate - 250 * scale);
    ctx.fillStyle = 'blue';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 25);
    const buffer = this.audioBuffer.getChannelData(0);
    for (let x = 0; x < 500; ++x) {
      ctx.lineTo(x, 25 + 25 * Math.pow(
        Math.abs(buffer[i]), 0.5));
      i += scale;
    }
    for (let x = 499; x >= 0; --x) {
      ctx.lineTo(x, 25 - 25 * Math.pow(
        Math.abs(buffer[i]), 0.5));
      i -= scale;
    }
    ctx.lineTo(0, 25);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(250, 0);
    ctx.lineTo(250, 50);
    ctx.stroke();

  }
}