// Cribbed from https://github.com/microsoft/TypeScript/issues/28308#issuecomment-650802278

interface AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: (new (
    options?: AudioWorkletNodeOptions
  ) => AudioWorkletProcessor) & {
    parameterDescriptors?: AudioParamDescriptor[];
  }
);

// End crib

export class SampleSourceWorker implements AudioWorkletProcessor {
  readonly port: MessagePort;

  constructor() {
    // super();
    this.port = new MessagePort();
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    if (inputs.length == 0) {
      throw new Error("No inputs.");
    }
    if (inputs[0].length > 0) {
      this.port.postMessage({
        newSamples: inputs[0]
      });
    }
    return true;
  }
}

registerProcessor('sample-source', SampleSourceWorker);