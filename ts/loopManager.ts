import { Audio } from "./audio";
import { Log } from "./Log";
import { Loop } from "./loop";

type LoopMode = 'waiting' | 'initial' | 'overdub' | 'play';

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
  private currentLoop: Loop;
  private loops: Loop[] = [];
  private loopLengthS: number;
  private beatLengthS: number = undefined;
  private startTimeS: number;

  // Scheduling state
  private scheduledThroughS: number;
  private static scheduleAheadS: number = 0.5;
  private playingLoops: PlayingLoop[] = [];
  private loopMode: LoopMode = 'waiting';
  private nextLoopStartS: number;

  // Rendering
  private canvas: HTMLCanvasElement;

  constructor(audio: Audio, firstLoop: Loop) {
    this.audio = audio;
    this.currentLoop = firstLoop;
    this.audioCtx = audio.audioCtx;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 100;
    this.canvas.height = 100;
    const body = document.getElementsByTagName('body')[0];
    body.appendChild(this.canvas);
  }

  private addFirstLoop(loop: Loop) {
    const nowTimeS = this.audioCtx.currentTime;
    if (this.loops.length > 0) {
      throw new Error('Already started playing.');
    }
    Log.debug(`Adding loop; playing: ${this.playingLoops.length}`);
    this.setTempo(loop.getBodyS());
    this.startTimeS = nowTimeS;
    this.scheduledThroughS = nowTimeS;
    loop.startSample(this.startTimeS);
    this.schedule();
    this.render();
  }

  private addGlue(a: Loop, b: Loop) {
    const body = document.getElementsByTagName('body')[0];
    const span = document.createElement('span');
    span.innerText = 'glue';
    span.classList.add('glue');
    body.appendChild(span);
  }

  private startNextLoop(nowTime: number) {
    this.currentLoop.stopRecording(nowTime);
    if (!this.beatLengthS) {
      this.addFirstLoop(this.currentLoop);
    }
    this.loops.push(this.currentLoop);
    this.nextLoopStartS = nowTime + this.currentLoop.getBodyS();
    this.currentLoop.addCanvas(60 / this.beatLengthS);
    if (this.loopMode === 'play') {
      this.currentLoop.mute();
    }
    const previousLoop = this.currentLoop;
    this.currentLoop = this.currentLoop.nextLoop();
    this.currentLoop.startRecording(nowTime);
    this.addGlue(previousLoop, this.currentLoop);
  }

  public nextMode() {
    switch (this.loopMode) {
      case 'waiting':
        Log.debug('Start.');
        this.currentLoop.startRecording(this.audioCtx.currentTime);
        this.loopMode = 'initial';
        break;
      case 'initial':
        const nowTime = this.audioCtx.currentTime;
        Log.debug('Captured.');
        this.startNextLoop(nowTime);
        this.loopMode = 'play';
        break;
      case 'play':
        this.loopMode = 'overdub';
        break;
      case 'overdub':
        this.loopMode = 'play';
        break;
    }
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
    Log.debug(`Beats per minute: ${60 / beatLengthS}`);
  }

  private render() {
    const elapsed = this.audioCtx.currentTime - this.startTimeS;
    const currentBeatFrac = (elapsed / this.beatLengthS) % 1.0;
    const currentBeatInt = Math.trunc(elapsed / this.beatLengthS);
    const currentMeasureNumber = Math.trunc(currentBeatInt / 4);
    const currentBeat = currentBeatInt % 4 + 1;
    const isOnBeat = currentBeatFrac < 0.5;

    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.lineWidth = 8;

    if (this.loopMode == 'overdub') {
      ctx.strokeStyle = '#933';
    } else if (this.loopMode == 'play') {
      ctx.strokeStyle = '#393';
    }
    ctx.beginPath();
    ctx.arc(50, 50, 45, -Math.PI, Math.PI);
    ctx.stroke();

    ctx.strokeStyle = '#393';

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

  // Called at beginning of each loop from Schedule.
  // Adds current loop to loops if in overdub mode.
  // Starts a new loop recording.
  private onTopOfLoop(audioTimstampS: number) {
    Log.debug('Top of loop...');
    this.startNextLoop(audioTimstampS);
  }

  private schedule() {
    if (this.audioCtx.currentTime + LoopManager.scheduleAheadS <
      this.scheduledThroughS) {
      // Nothing to do.  We are scheduled up through our schedule ahead buffer.
      setTimeout(() => { this.schedule(); }, 100);
      return;
    }

    const nextScheduleThroughS =
      this.scheduledThroughS + LoopManager.scheduleAheadS;

    if (this.audioCtx.currentTime + LoopManager.scheduleAheadS >
      this.nextLoopStartS) {
      this.onTopOfLoop(this.nextLoopStartS);
      const loopsToDelete: Loop[] = [];
      for (const l of this.loops) {
        if (l.deleted()) {
          loopsToDelete.push(l);
        } else {
          l.startSample(this.nextLoopStartS);
        }
      }
      this.nextLoopStartS += this.loopLengthS;
      for (const toDelete of loopsToDelete) {
        this.loops.splice(this.loops.indexOf(toDelete), 1);
      }
    }

    this.scheduledThroughS = nextScheduleThroughS;

    setTimeout(() => { this.schedule(); }, 100);
  }
}