import { Audio } from "./audio";
import { Loop } from "./loop";

type LoopMode = 'standby' | 'recording' | 'playing';

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
  private loopLengthS: number;
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

  private overdub(loop: Loop) {
    const currentAudioTime = this.audioCtx.currentTime;
    const beatAudioTime = this.getNextLoopStart(currentAudioTime);
    const nextLoop = loop.nextLoop();
    nextLoop.startRecording(beatAudioTime);
    const delayS = loop.getBodyS() + beatAudioTime - currentAudioTime;
    setTimeout(() => {
      nextLoop.stopRecording(beatAudioTime + loop.getBodyS());
      this.addLoop(nextLoop);
    }, delayS * 1000);
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
    this.overdub(loop);
    this.loops.push(loop);
  }

  private start(loop: Loop, startTimeS: number) {
    this.playingLoops.push(new PlayingLoop(loop, startTimeS));
    loop.startSample(startTimeS);
  }

  private setTempo(durationS: number) {
    this.loopLengthS = durationS;
    let beatLengthS = durationS;
    while (beatLengthS < 0.5) {
      beatLengthS *= 2;
    }
    while (beatLengthS > 1.0) {
      beatLengthS /= 2;
    }
    this.beatLengthS = beatLengthS;
    console.log(`Beats per minute: ${60 / beatLengthS}`);
  }

  // TODO: This does not handle changing loop length.
  public getNextLoopStart(timestamp: number): number {
    if (!this.loopLengthS) {
      return timestamp;
    }
    const elapsed = timestamp - this.startTimeS;
    // Playback: |--- Loop 0 ---|--- Loop 1 ---|---
    // NextLoop     ^     Loop 1   ^    Loop 2    ^
    const nextLoopNumber = Math.trunc(1 + (elapsed - 0.5) / this.loopLengthS);
    return this.loopLengthS * nextLoopNumber;
  }

  private startAtNearestDownbeat(loop: Loop,
    timestamp: number = this.audioCtx.currentTime) {
    const currentMeasureStart = this.getNextLoopStart(timestamp);
    this.start(loop, currentMeasureStart);
  }

  private render() {
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#393';

    const elapsed = this.audioCtx.currentTime - this.startTimeS;

    const currentBeatFrac = (elapsed / this.beatLengthS) % 1.0;
    const currentBeatInt = Math.trunc(elapsed / this.beatLengthS);
    const currentMeasureNumber = Math.trunc(currentBeatInt / 4);
    const currentBeat = currentBeatInt % 4 + 1;

    const start = -Math.PI / 2;

    ctx.beginPath();
    ctx.arc(50, 50, 20, start, start + Math.PI * 2 * currentBeatFrac);
    ctx.stroke();

    ctx.fillStyle = 'black';
    ctx.fillText(`beat: ${currentBeat.toFixed(0)}`, 20, 20);
    ctx.fillText(`measure: ${currentMeasureNumber.toFixed(0)}`, 20, 40);
    ctx.fillText(`elapsed: ${elapsed.toFixed(3)}`, 20, 60);

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
      const nextScheduleTime = this.getNextLoopStart(
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