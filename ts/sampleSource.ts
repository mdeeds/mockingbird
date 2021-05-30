import { request } from "http";
import { Audio } from "./audio";

type SampleSourceResolution = (self: SampleSource) => void;
type SampleCallback = (samples: Float32Array, endTimeS: number) => void;

export class SampleSource {
  private mediaSource: MediaStreamAudioSourceNode;
  private mediaRecorder: MediaRecorder;
  private firstChunkSize: number = 0;
  private firstChunk: Blob = null;
  private listener: SampleCallback = null;
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

  public setListener(callback: SampleCallback) {
    this.listener = callback;
  }

  private setUpAnalyser(mediaSource: MediaStreamAudioSourceNode) {
    const body = document.getElementsByTagName('body')[0];
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const analyzer = this.audioCtx.createAnalyser();
    analyzer.fftSize = 2048;
    this.mediaSource.connect(analyzer);
    const dataArray = new Float32Array(analyzer.frequencyBinCount);
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      analyzer.getFloatTimeDomainData(dataArray)
      ctx.fillStyle = 'blue';
      for (let i = 0; i < dataArray.length; i += 20) {
        ctx.fillRect(i / 20, 50, 1, 1 + 50 * dataArray[i])
      }
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }

  private handleStream(stream: MediaStream, resolve: SampleSourceResolution) {
    this.mediaSource = this.audioCtx.createMediaStreamSource(stream);
    this.setUpAnalyser(this.mediaSource);


    var options = {
      mimeType: "audio/webm;codecs=pcm",
    }
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = new MediaRecorder(stream, options);
    this.mediaRecorder.onstart = (e) => {
      console.log(`Media stream start ${stream.id}`);
    };

    this.mediaRecorder.onstop = (e: BlobEvent) => {
      this.decodeChunk(e.data);
      this.mediaRecorder = null;
    };

    this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
      this.decodeChunk(e.data);
    };

    this.mediaRecorder.start(/*timeslice=*/ 500 /*ms*/);
    console.log(`Initialized @ ${this.audioCtx.currentTime}`);
    resolve(this);
  }

  private maxOfArray(a: Float32Array) {
    let m = a[0];
    for (const x of a) {
      m = Math.max(m, x);
    }
    return m;
  }

  private decodeChunk(chunk: Blob) {
    let chunkEndTime = this.audioCtx.currentTime;
    let fileReader = new FileReader();
    fileReader.onloadend = () => {
      const encodedData: ArrayBuffer = fileReader.result as ArrayBuffer;
      // console.log("Encoded length: " + encodedData.byteLength);
      this.audioCtx.decodeAudioData(encodedData,
        (decodedSamples) => {
          // TODO: Consider supporting stereo or more channels.
          let newSamples = decodedSamples.getChannelData(0)
            .slice(this.firstChunkSize, decodedSamples.length);
          if (this.listener && newSamples.length > 0) {
            setTimeout(() => { this.listener(newSamples, chunkEndTime); }, 0);
          }
          if (this.firstChunkSize == 0) {
            this.firstChunkSize = decodedSamples.length;
          }
        }, (er) => {
          console.error(er);
        });
    };

    let blob: Blob;
    if (!this.firstChunk) {
      this.firstChunk = chunk;
      blob = new Blob([chunk], { 'type': chunk.type });
    } else {
      blob = new Blob([this.firstChunk, chunk], { 'type': chunk.type });
    }
    fileReader.readAsArrayBuffer(blob);
  }
}