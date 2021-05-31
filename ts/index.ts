import { Audio } from "./audio";
import { Loop } from "./loop";
import { LoopManager } from "./loopManager";
import { SampleSource } from "./sampleSource";

async function go() {
  const a = await Audio.make();
  const s = await SampleSource.make(a);
  let l = new Loop(s);

  let recentlyCompletedLoop = null;

  const lm = new LoopManager(a);

  const body = document.getElementsByTagName('body')[0];
  let isRecording = false;
  let changeRate = 0;
  body.addEventListener('keydown', (ev: KeyboardEvent) => {
    switch (ev.code) {
      case 'Space':
        console.log(`Space @ ${a.audioCtx.currentTime}`);
        if (isRecording) {
          l.stopRecording(a.audioCtx.currentTime);
          lm.addLoop(l);
          recentlyCompletedLoop = l;
          l = l.nextLoop();
          isRecording = false;
        } else {
          l.startRecording(a.audioCtx.currentTime);
          isRecording = true;
        }
        break;
      case 'ArrowRight':
        if (recentlyCompletedLoop) {
          if (changeRate > 0) {
            changeRate = Math.min(changeRate * 2, 0.05);
          } else {
            changeRate = 0.001;
          }
          recentlyCompletedLoop.adjustStartPoint(changeRate);
        }
        break;
      case 'ArrowLeft':
        if (recentlyCompletedLoop) {
          if (changeRate < 0) {
            changeRate = Math.max(changeRate * 2, -0.05);
          } else {
            changeRate = -0.001;
          }
          recentlyCompletedLoop.adjustStartPoint(changeRate);
        }
        break;
    }
  });
}

go();
