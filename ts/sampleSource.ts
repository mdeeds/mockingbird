import { Audio } from "./audio";

type SampleSourceResolution = (self: SampleSource) => void;
type SampleCallback = (samples: Float32Array, endTimeS: number) => void;

export class SampleSource {
  private mediaSource: MediaStreamAudioSourceNode;
  private firstChunkSize: number = 0;
  private firstChunk: Blob = null;
  private listeners = new Map<Object, SampleCallback>();
  readonly audioCtx: AudioContext;
  readonly audio: Audio;

  private constructor(audio: Audio) {
    this.audio = audio;
    this.audioCtx = audio.audioCtx;
  }

  public static make(audio: Audio): Promise<SampleSource> {
    const self = new SampleSource(audio);

    console.log("Attempting to initialize.");
    console.assert(!!navigator.mediaDevices.getUserMedia);
    var constraints = {
      audio: true,
      video: false,
      echoCancellation: false,
      noiseSuppersion: false,
    };
    return new Promise(async (resolve, reject) => {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      self.handleStream(stream, resolve);
    });
  }

  public addListener(source: Object, callback: SampleCallback) {
    this.listeners.set(source, callback);
  }

  public removeListener(source: Object) {
    this.listeners.delete(source);
  }

  private setUpAnalyser(mediaSource: MediaStreamAudioSourceNode) {
    const body = document.getElementsByTagName('body')[0];
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const analyser = this.audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    this.mediaSource.connect(analyser);
    const dataArray = new Float32Array(analyser.frequencyBinCount);
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      analyser.getFloatTimeDomainData(dataArray)
      let m = 0;
      let s = 0;
      for (let i = 0; i < dataArray.length; ++i) {
        const v = Math.pow(Math.abs(dataArray[i]), 0.3);
        m = Math.max(m, v);
        s += v;
      }
      const thetaMax = Math.PI * m;
      const thetaMean = Math.PI * s / dataArray.length;
      const start = Math.PI / 2;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#44f';
      ctx.lineWidth = 25;
      ctx.arc(50, 50, 30, start - thetaMean, start + thetaMean);
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = '#f48';
      ctx.lineWidth = 5;
      ctx.arc(50, 50, 30, start - thetaMax, start + thetaMax);
      ctx.stroke();

      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }

  private async handleStream(stream: MediaStream, resolve: SampleSourceResolution) {
    this.mediaSource = this.audioCtx.createMediaStreamSource(stream);
    this.setUpAnalyser(this.mediaSource);

    await this.audioCtx.audioWorklet.addModule(
      `sampleSourceWorker.js?buster=${Math.random().toFixed(6)}`);
    const worklet = new AudioWorkletNode(this.audioCtx, 'sample-source');

    let workerStartTime = this.audioCtx.currentTime;
    let workerElapsedFrames = 0;

    worklet.port.onmessage = (event) => {
      for (const listener of this.listeners.values()) {
        setTimeout(() => {
          workerElapsedFrames += event.data.newSamples.length;
          const chunkEndTime = workerStartTime +
            workerElapsedFrames / this.audioCtx.sampleRate;
          listener(event.data.newSamples, chunkEndTime);
        }, 0);
      }
    }

    this.mediaSource.connect(worklet);
    resolve(this);
  }
}