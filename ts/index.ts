import { Audio } from "./audio";
import { Log } from "./Log";
import { Loop } from "./loop";
import { LoopManager } from "./loopManager";
import { SampleSource } from "./sampleSource";

async function go() {
  const body = document.getElementsByTagName('body')[0];

  const mm = document.createElement('div');
  const report = function () {
    const mem: any = window.performance['memory'];
    mm.innerText = `${(mem.usedJSHeapSize / 1000000).toFixed(3)}MB`;
    setTimeout(report, 100);
  }
  body.appendChild(mm);
  report();

  const a = await Audio.make();
  const s = await SampleSource.make(a);
  let l = new Loop(s);

  const lm = new LoopManager(a, l);

  body.addEventListener('keydown', (ev: KeyboardEvent) => {
    switch (ev.code) {
      case 'Space':
        Log.info(`Space @ ${a.audioCtx.currentTime}`);
        lm.nextMode();
        break;
    }
  });
}

go();
