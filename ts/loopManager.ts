import { Audio } from "./audio";
import { Loop } from "./loop";

type loopMode = 'overdub' | 'oneshot' | 'loop';

class PlayingLoop {
  public readonly loop: Loop;
  public startTimeS: number;
  constructor(loop: Loop, startTimeS: number) {
    this.loop = loop;
    this.startTimeS = startTimeS;
  }
}

export class LoopManager {
  private audio: Audio;
  readonly audioCtx: AudioContext;
  private loops: Loop[] = [];
  private beatLengthS: number;
  private startTimeS: number;

  // Scheduling state
  private scheduledThroughS: number;
  private static scheduleAheadS: number = 1.5;
  private playingLoops: PlayingLoop[] = [];

  // Rendering
  private canvas: HTMLCanvasElement;

  constructor(audio: Audio) {
    this.audio = audio;
    this.audioCtx = audio.audioCtx;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 100;
    this.canvas.height = 100;
    const body = document.getElementsByTagName('body')[0];
    body.appendChild(this.canvas);
  }

  addLoop(loop: Loop) {
    console.log(`Adding loop; playing: ${this.playingLoops.length}`);
    if (this.loops.length == 0) {
      this.setTempo(loop.getBodyS());
      this.startTimeS = this.audioCtx.currentTime;
      this.scheduledThroughS = this.audioCtx.currentTime;
      this.start(loop, this.startTimeS);
      this.schedule();
      this.render();
    } else {
      this.startAtNearestDownbeat(loop);
    }
    this.loops.push(loop);
  }

  private start(loop: Loop, startTimeS: number) {
    this.playingLoops.push(new PlayingLoop(loop, startTimeS));
    loop.startSample(startTimeS);
  }

  private setTempo(durationS: number) {
    this.beatLengthS = durationS;
    while (this.beatLengthS < 0.5) {
      this.beatLengthS *= 2;
    }
    while (this.beatLengthS > 1.0) {
      this.beatLengthS /= 2;
    }
    console.log(`Beats per minute: ${60 / this.beatLengthS}`);
  }

  public getNearestDownbeat(timestamp: number): number {
    if (!this.beatLengthS) {
      return timestamp;
    }
    const currentMeasureNumber = Math.round(
      (timestamp - this.startTimeS) / (this.beatLengthS * 4));
    const currentMeasureStart =
      this.startTimeS + currentMeasureNumber * (this.beatLengthS * 4);
    return currentMeasureStart;
  }

  private startAtNearestDownbeat(loop: Loop,
    timestamp: number = this.audioCtx.currentTime) {
    const currentMeasureStart = this.getNearestDownbeat(timestamp);
    this.start(loop, currentMeasureStart);
  }

  private render() {
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#393';

    const now = this.audioCtx.currentTime;

    const currentMeasureNumber = Math.trunc(
      (now - this.startTimeS) / (this.beatLengthS * 4));
    const currentMeasureStart =
      this.startTimeS + currentMeasureNumber * (this.beatLengthS * 4);

    const currentFloatBeat = now - currentMeasureStart;
    const currentBeat = Math.trunc(currentFloatBeat) + 1;
    const currentFracBeat = currentFloatBeat - currentBeat + 1;

    const start = -Math.PI / 2;

    ctx.beginPath();
    ctx.arc(50, 50, 20, start, start + Math.PI * 2 * currentFracBeat);
    ctx.stroke();

    ctx.fillStyle = 'black';
    ctx.fillText(currentBeat.toFixed(0), 20, 20);

    requestAnimationFrame(() => { this.render(); });
  }

  private schedule() {
    if (this.audioCtx.currentTime + LoopManager.scheduleAheadS < this.scheduledThroughS) {
      // Nothing to do.  We are scheduled up through our schedule ahead buffer.
      setTimeout(() => { this.schedule(); }, 100);
      return;
    }

    const nextScheduleThroughS =
      this.scheduledThroughS + LoopManager.scheduleAheadS;

    for (const pl of this.playingLoops) {
      const nextScheduleTime = this.getNearestDownbeat(
        pl.startTimeS + pl.loop.getBodyS());
      if (nextScheduleTime > this.scheduledThroughS &&
        nextScheduleTime <= nextScheduleThroughS) {
        this.start(pl.loop, nextScheduleTime);
      }
    }

    while (this.playingLoops.length > 0) {
      const playingLoop = this.playingLoops[0];
      const loopEndTime =
        playingLoop.startTimeS + playingLoop.loop.getPlayLengthS();
      if (loopEndTime < this.audioCtx.currentTime) {
        this.playingLoops.shift();
      } else {
        break;
      }
    }

    this.scheduledThroughS = nextScheduleThroughS;

    setTimeout(() => { this.schedule(); }, 100);
  }
}