import { Audio } from "./audio";
import { Loop } from "./loop";
import { LoopManager } from "./loopManager";
import { SampleSource } from "./sampleSource";

async function go() {
  const a = await Audio.make();
  const s = await SampleSource.make(a);
  let l = new Loop(s);

  const lm = new LoopManager(a);

  const body = document.getElementsByTagName('body')[0];
  let isRecording = false;
  body.addEventListener('keydown', (ev: KeyboardEvent) => {
    if (ev.code === 'Space') {
      console.log(`Space @ ${a.audioCtx.currentTime}`);
      if (isRecording) {
        l.stopRecording(a.audioCtx.currentTime);
        lm.addLoop(l);
        l = l.nextLoop();
        isRecording = false;
      } else {
        l.startRecording(a.audioCtx.currentTime);
        isRecording = true;
      }
    }
  });
}

go();
