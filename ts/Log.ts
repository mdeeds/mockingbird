export class Log {
  static info(message: any) {
    const ts = (performance.now() / 1000).toFixed(3);
    console.log(`${ts} ${message}`);
  }

  static debug(message: any) {
    // Do nothing... for now.
  }
}