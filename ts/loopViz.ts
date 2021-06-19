export class LoopViz {

  private static getPeaks(buffer: Float32Array,
    samplesPerPeak: number,
    offset: number): number[] {
    const result: number[] = [];

    let m = 0;
    for (let i = offset; i < buffer.length; ++i) {
      result.push(m);
      const nextI = Math.min(buffer.length, i + samplesPerPeak);
      m = 0;
      while (i < nextI) {
        m = Math.max(m,
          Math.pow(
            Math.abs(buffer[i]), 0.5));
        ++i
      }
    }

    return result;
  }

  static render(samples: Float32Array,
    sampleRate: number, bpm: number, headerS: number,
    canvas: HTMLCanvasElement) {
    console.log('render');
    const peaksPerSecond = 200;
    const secondsPerPeak = 1 / peaksPerSecond;
    const samplesPerPeak = sampleRate * secondsPerPeak;

    const radiansPerBeat = Math.PI / 2;
    const secondsPerRadian = (60 / bpm) / radiansPerBeat;
    const peaksPerRadian = peaksPerSecond * secondsPerRadian;
    const radiansPerPeak = 1 / peaksPerRadian;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'blue';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 0.5;
    const peaks = this.getPeaks(
      samples,
      samplesPerPeak,
      Math.round(headerS * sampleRate));
    ctx.beginPath();
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = Math.min(cx, cy);
    ctx.moveTo(cx, cy);

    let t = Math.PI / 2;  // Start downward.
    for (let x = 0; x < peaks.length; ++x) {
      ctx.lineTo(cx + Math.cos(t) * r * peaks[x],
        cy + Math.sin(t) * r * peaks[x]);
      t += radiansPerPeak;
    }
    console.log(t);
    ctx.lineTo(cx, cy);
    ctx.fill();
    ctx.stroke();
  }
}