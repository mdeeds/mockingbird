import { Log } from "./Log";
import { LoopViz } from "./loopViz";
import { SampleSource } from "./sampleSource";

export class Loop {
  private static maxHeaderS: number = 0.5;
  private static maxFooterS: number = 0.5;

  readonly audioCtx: AudioContext;
  private sampleSource: SampleSource;

  // State data
  private recordUntil: number = 0;
  private isFinalized: boolean = false;
  private isMuted: boolean = false;
  private isDeleted: boolean = false;

  // Sample data
  private sampleStartS: number;
  private recordingStartS: number;
  private recordingEndS: number;
  private sampleLengthS: number = 0;
  private sampleList: Float32Array[] = [];

  // Buffer data
  private audioBuffer: AudioBuffer = null;
  private source: AudioBufferSourceNode = null;
  private headerS: number = undefined;
  private bodyS: number = undefined;
  private offsetS: number = 0.0;

  // Visualization
  private canvas: HTMLCanvasElement;
  private bpm: number = 90;

  constructor(sampleSource: SampleSource) {
    this.sampleSource = sampleSource;
    this.audioCtx = sampleSource.audioCtx;
    this.sampleSource.addListener(this,
      (samples: Float32Array, endTimeS: number) => {
        this.handleSamples(samples, endTimeS);
      });
  }

  nextLoop(): Loop {
    const result = new Loop(this.sampleSource);
    result.sampleStartS = this.sampleStartS;
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

  adjustStartPoint(deltaS: number) {
    this.headerS += deltaS;
    this.offsetS += deltaS;
    if (this.headerS < 0) {
      this.offsetS -= this.headerS;
      this.headerS = 0;
    }

    this.renderCanvas();
  }

  startRecording(timestamp: number) {
    Log.debug(`Start recording; sample list length: ${this.sampleList.length}`);
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
    Log.info(`Stop recording; sample list length: ${this.sampleList.length}`);
    if (this.isFinalized) {
      throw new Error("Already finalized");
    }
    this.recordUntil = timestamp + Loop.maxFooterS;

    // The buffer for the AudioBufferSourceNode can be modified
    // after the recording has stopped.  So, at this point we just
    // create the entire audio buffer and dump the tail samples into it as
    // they arrive. 
    this.bodyS = timestamp - this.recordingStartS;
    this.headerS = Loop.maxHeaderS;
    const loopLengthS = this.bodyS + Loop.maxHeaderS + Loop.maxFooterS;
    const loopLengthSamples = loopLengthS * this.audioCtx.sampleRate;

    this.audioBuffer = this.audioCtx.createBuffer(
      1, loopLengthSamples, this.audioCtx.sampleRate);
    for (let i = 0; i < this.sampleList.length; ++i) {
      this.fillFromSamples(i);
    }
  }

  startSample(timestamp: number) {
    if (this.isMuted) {
      return;
    }
    const currentTime = this.audioCtx.currentTime;
    this.source = this.audioCtx.createBufferSource();
    this.source.buffer = this.audioBuffer;
    this.source.connect(this.audioCtx.destination);
    if (currentTime > timestamp) {
      // We are already late.
      const lateS = currentTime - timestamp;
      this.source.start(currentTime,
        currentTime - timestamp + this.headerS);
    } else {
      this.source.start(timestamp, this.headerS);
    }
    this.source.stop(timestamp + this.bodyS);
  }

  finalize() {
    Log.debug("Finalize");
    for (let i = 0; i < this.sampleList.length; ++i) {
      this.fillFromSamples(i);
    }
    // this.renderCanvas();
    this.sampleSource.removeListener(this);
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
    Log.debug(`handleSamples: ${samples.length} @ ${endTimeS}`);
    const samplesLengthS = samples.length / this.audioCtx.sampleRate;
    if (this.sampleList.length === 0) {
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
      this.sampleList.push(samples);
      this.sampleLengthS += samplesLengthS;
      if (this.audioBuffer) {
        this.fillFromSamples(this.sampleList.length - 1);
      }
      this.finalize();
    }
  }

  private renderCanvas() {
    if (!this.canvas) {
      throw new Error('Render called before we have a canvas.');
    }

    LoopViz.render(this.audioBuffer.getChannelData(0),
      this.audioCtx.sampleRate, this.bpm, this.headerS, this.canvas);

    const ctx = this.canvas.getContext('2d');
    ctx.beginPath();
    ctx.fillStyle = 'black';
    ctx.fillText(`${(this.offsetS * 1000).toFixed(0)}ms`, 5, 20);
  }

  static changeRate: number = 0.001;

  private handleKey(ev: KeyboardEvent) {
    switch (ev.code) {
      case 'ArrowRight':
        if (Loop.changeRate > 0) {
          Loop.changeRate = Math.min(Loop.changeRate * 2, 0.05);
        } else {
          Loop.changeRate *= -0.5;
        }
        this.adjustStartPoint(Loop.changeRate);
        break;
      case 'ArrowLeft':
        if (Loop.changeRate < 0) {
          Loop.changeRate = Math.max(Loop.changeRate * 2, -0.05);
        } else {
          Loop.changeRate *= -0.5;
        }
        this.adjustStartPoint(Loop.changeRate);
        break;
      case 'Backspace':
      case 'Delete':
        this.mute();
        this.audioBuffer = null;
        this.sampleList = null;
        this.span.remove();
        this.isDeleted = true;
        break;
    }
  }

  public mute() {
    this.isMuted = true;
    this.span.classList.add('muted');
  }

  public deleted() {
    return this.isDeleted;
  }

  private span: HTMLSpanElement;

  public addCanvas(bpm: number) {
    this.bpm = bpm;
    console.log(`BPM: ${bpm}`);
    const body = document.getElementsByTagName('body')[0];
    this.span = document.createElement('span');
    // div.addEventListener('click', () => { div.focus(); });
    this.span.addEventListener('touchstart', () => {
      this.span.focus();
      this.isMuted = !this.isMuted;
      if (this.isMuted) {
        this.span.classList.add('muted');
      } else {
        this.span.classList.remove('muted');
      }
    });
    this.span.addEventListener('keydown', (ev) => { this.handleKey(ev); });
    this.span.classList.add('loopContainer');
    this.span.tabIndex = 0;
    body.appendChild(this.span);
    this.canvas = document.createElement('canvas');
    this.canvas.width = 100;
    this.canvas.height = 100;
    this.span.appendChild(this.canvas);

    this.renderCanvas();
  }
}