import { Audio } from "./audio";
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

  let recentlyCompletedLoop = null;

  const lm = new LoopManager(a, l);

  let changeRate = 0;
  body.addEventListener('keydown', (ev: KeyboardEvent) => {
    switch (ev.code) {
      case 'Space':
        console.log(`Space @ ${a.audioCtx.currentTime}`);
        lm.nextMode();
        break;
    }
  });
}

go();
