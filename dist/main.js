/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 700:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Log = void 0;
class Log {
    static info(message) {
        const ts = (performance.now() / 1000).toFixed(3);
        console.log(`${ts} ${message}`);
    }
}
exports.Log = Log;
//# sourceMappingURL=Log.js.map

/***/ }),

/***/ 458:
/***/ (function(__unused_webpack_module, exports) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Audio = void 0;
class Audio {
    constructor(context) {
        this.audioCtx = context;
    }
    static make() {
        return __awaiter(this, void 0, void 0, function* () {
            const ctx = yield Audio.getAudioContext();
            return new Promise((resolve, reject) => {
                resolve(new Audio(ctx));
            });
        });
    }
    static getAudioContext() {
        return new Promise((resolve, reject) => {
            const context = new window.AudioContext();
            if (context.state === 'running') {
                resolve(context);
            }
            else {
                setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                    resolve(yield Audio.getAudioContext());
                }), 500);
            }
        });
    }
    static HzFromNote(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }
}
exports.Audio = Audio;
//# sourceMappingURL=audio.js.map

/***/ }),

/***/ 138:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const audio_1 = __webpack_require__(458);
const loop_1 = __webpack_require__(980);
const loopManager_1 = __webpack_require__(48);
const sampleSource_1 = __webpack_require__(930);
function go() {
    return __awaiter(this, void 0, void 0, function* () {
        const body = document.getElementsByTagName('body')[0];
        const mm = document.createElement('div');
        const report = function () {
            const mem = window.performance['memory'];
            mm.innerText = `${(mem.usedJSHeapSize / 1000000).toFixed(3)}MB`;
            setTimeout(report, 100);
        };
        body.appendChild(mm);
        report();
        const a = yield audio_1.Audio.make();
        const s = yield sampleSource_1.SampleSource.make(a);
        let l = new loop_1.Loop(s);
        let recentlyCompletedLoop = null;
        const lm = new loopManager_1.LoopManager(a, l);
        let changeRate = 0;
        body.addEventListener('keydown', (ev) => {
            switch (ev.code) {
                case 'Space':
                    console.log(`Space @ ${a.audioCtx.currentTime}`);
                    lm.nextMode();
                    break;
            }
        });
    });
}
go();
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 980:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Loop = void 0;
const Log_1 = __webpack_require__(700);
const loopViz_1 = __webpack_require__(96);
class Loop {
    constructor(sampleSource) {
        // State data
        this.recordUntil = 0;
        this.isFinalized = false;
        this.isMuted = false;
        this.sampleLengthS = 0;
        this.sampleList = [];
        // Buffer data
        this.audioBuffer = null;
        this.source = null;
        this.headerS = undefined;
        this.bodyS = undefined;
        this.offsetS = 0.0;
        this.bpm = 90;
        this.sampleSource = sampleSource;
        this.audioCtx = sampleSource.audioCtx;
        this.sampleSource.addListener(this, (samples, endTimeS) => {
            this.handleSamples(samples, endTimeS);
        });
    }
    nextLoop() {
        const result = new Loop(this.sampleSource);
        result.sampleStartS = this.sampleStartS;
        for (const s of this.sampleList) {
            result.rollSamples(s);
        }
        return result;
    }
    getBodyS() {
        if (!this.bodyS) {
            throw new Error("Loop is not complete.");
        }
        return this.bodyS;
    }
    getPlayLengthS() {
        if (!this.bodyS) {
            throw new Error("Loop is not complete.");
        }
        return this.bodyS + Loop.maxFooterS;
    }
    adjustStartPoint(deltaS) {
        this.headerS += deltaS;
        this.offsetS += deltaS;
        this.renderCanvas();
    }
    startRecording(timestamp) {
        Log_1.Log.info(`Start recording; sample list length: ${this.sampleList.length}`);
        if (this.recordUntil > 0) {
            throw new Error("Already recording.");
        }
        this.recordUntil = Infinity;
        this.recordingStartS = timestamp;
    }
    fillFromSamples(sampleIndex) {
        const headerStartS = this.recordingStartS - Loop.maxHeaderS;
        // Offset into buffer measured in sample points to where this sample starts
        let bufferStart = Math.round((this.sampleStartS - headerStartS) * this.audioCtx.sampleRate);
        for (let i = 0; i < sampleIndex; ++i) {
            bufferStart += this.sampleList[i].length;
        }
        const buffer = this.audioBuffer.getChannelData(0);
        const sample = this.sampleList[sampleIndex];
        let numFilled = 0;
        for (let i = 0; i < sample.length; ++i) {
            const targetOffset = i + bufferStart;
            if (targetOffset >= 0 && targetOffset < buffer.length) {
                buffer[targetOffset] = sample[i];
                ++numFilled;
            }
        }
    }
    stopRecording(timestamp) {
        Log_1.Log.info(`Stop recording; sample list length: ${this.sampleList.length}`);
        if (this.isFinalized) {
            throw new Error("Already finalized");
        }
        this.recordUntil = timestamp + Loop.maxFooterS;
        // The buffer for the AudioBufferSourceNode can be modified
        // after the recording has stopped.  So, at this point we just
        // create the entire audio buffer and dump the tail samples into it as
        // they arrive. 
        this.bodyS = timestamp - this.recordingStartS;
        this.headerS = Loop.maxHeaderS;
        const loopLengthS = this.bodyS + Loop.maxHeaderS + Loop.maxFooterS;
        const loopLengthSamples = loopLengthS * this.audioCtx.sampleRate;
        this.audioBuffer = this.audioCtx.createBuffer(1, loopLengthSamples, this.audioCtx.sampleRate);
        for (let i = 0; i < this.sampleList.length; ++i) {
            this.fillFromSamples(i);
        }
    }
    startSample(timestamp) {
        if (this.isMuted) {
            Log_1.Log.info(`Muted.`);
            return;
        }
        const currentTime = this.audioCtx.currentTime;
        this.source = this.audioCtx.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.connect(this.audioCtx.destination);
        if (currentTime > timestamp) {
            // We are already late.
            const lateS = currentTime - timestamp;
            this.source.start(currentTime, currentTime - timestamp);
        }
        else {
            this.source.start(timestamp);
        }
        this.source.stop(timestamp + this.bodyS);
    }
    finalize() {
        Log_1.Log.info("Finalize");
        for (let i = 0; i < this.sampleList.length; ++i) {
            this.fillFromSamples(i);
        }
        // this.renderCanvas();
        this.sampleSource.removeListener(this);
        this.isFinalized = true;
    }
    maxOfArray(a) {
        let m = a[0];
        for (const x of a) {
            m = Math.max(m, x);
        }
        return m;
    }
    rollSamples(samples) {
        // We have not started recording.  Keep a rolling buffer.
        const samplesLengthS = samples.length / this.audioCtx.sampleRate;
        this.sampleList.push(samples.slice());
        this.sampleLengthS += samplesLengthS;
        while (true) {
            const firstBufferLengthS = this.sampleList[0].length / this.audioCtx.sampleRate;
            if (this.sampleLengthS - firstBufferLengthS < Loop.maxHeaderS) {
                break;
            }
            this.sampleList.shift();
            this.sampleLengthS -= firstBufferLengthS;
            this.sampleStartS += firstBufferLengthS;
        }
    }
    handleSamples(samples, endTimeS) {
        const samplesLengthS = samples.length / this.audioCtx.sampleRate;
        if (this.sampleList.length === 0) {
            this.sampleStartS = endTimeS - samplesLengthS;
        }
        if (this.recordUntil === 0) {
            this.rollSamples(samples);
        }
        else if (endTimeS < this.recordUntil) {
            // Recording has started.  Fill the samples as they arrive.
            this.sampleList.push(samples);
            this.sampleLengthS += samplesLengthS;
            if (this.audioBuffer) {
                this.fillFromSamples(this.sampleList.length - 1);
            }
        }
        else if (!this.isFinalized) {
            this.sampleList.push(samples);
            this.sampleLengthS += samplesLengthS;
            if (this.audioBuffer) {
                this.fillFromSamples(this.sampleList.length - 1);
            }
            this.finalize();
        }
    }
    renderCanvas() {
        if (!this.canvas) {
            throw new Error('Render called before we have a canvas.');
        }
        loopViz_1.LoopViz.render(this.audioBuffer.getChannelData(0), this.audioCtx.sampleRate, this.bpm, this.headerS, this.canvas);
        const ctx = this.canvas.getContext('2d');
        ctx.beginPath();
        ctx.fillStyle = 'black';
        ctx.fillText(`${(this.offsetS * 1000).toFixed(0)}ms`, 5, 20);
    }
    handleKey(ev) {
        switch (ev.code) {
            case 'ArrowRight':
                if (Loop.changeRate > 0) {
                    Loop.changeRate = Math.min(Loop.changeRate * 2, 0.05);
                }
                else {
                    Loop.changeRate *= -0.5;
                }
                this.adjustStartPoint(Loop.changeRate);
                break;
            case 'ArrowLeft':
                if (Loop.changeRate < 0) {
                    Loop.changeRate = Math.max(Loop.changeRate * 2, -0.05);
                }
                else {
                    Loop.changeRate *= -0.5;
                }
                this.adjustStartPoint(Loop.changeRate);
                break;
        }
    }
    addCanvas(bpm) {
        this.bpm = bpm;
        console.log(`BPM: ${bpm}`);
        const body = document.getElementsByTagName('body')[0];
        const span = document.createElement('span');
        // div.addEventListener('click', () => { div.focus(); });
        span.addEventListener('touchstart', () => {
            span.focus();
            this.isMuted = !this.isMuted;
            if (this.isMuted) {
                span.classList.add('muted');
            }
            else {
                span.classList.remove('muted');
            }
        });
        span.addEventListener('keydown', (ev) => { this.handleKey(ev); });
        span.classList.add('loopContainer');
        span.tabIndex = 0;
        body.appendChild(span);
        this.canvas = document.createElement('canvas');
        this.canvas.width = 100;
        this.canvas.height = 100;
        span.appendChild(this.canvas);
        span.focus();
        this.renderCanvas();
    }
}
exports.Loop = Loop;
Loop.maxHeaderS = 0.5;
Loop.maxFooterS = 0.5;
Loop.changeRate = 0.001;
//# sourceMappingURL=loop.js.map

/***/ }),

/***/ 48:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.LoopManager = void 0;
const Log_1 = __webpack_require__(700);
class PlayingLoop {
    constructor(loop, startTimeS) {
        this.loop = loop;
        this.startTimeS = startTimeS;
    }
}
class LoopManager {
    constructor(audio, firstLoop) {
        this.loops = [];
        this.playingLoops = [];
        this.loopMode = 'waiting';
        this.audio = audio;
        this.curentLoop = firstLoop;
        this.audioCtx = audio.audioCtx;
        this.canvas = document.createElement('canvas');
        this.canvas.width = 100;
        this.canvas.height = 100;
        const body = document.getElementsByTagName('body')[0];
        body.appendChild(this.canvas);
    }
    nextMode() {
        switch (this.loopMode) {
            case 'waiting':
                Log_1.Log.info('Start.');
                this.curentLoop.startRecording(this.audioCtx.currentTime);
                this.loopMode = 'initial';
                break;
            case 'initial':
                const nowTime = this.audioCtx.currentTime;
                Log_1.Log.info('Captured.');
                this.curentLoop.stopRecording(nowTime);
                this.addFirstLoop(this.curentLoop);
                this.nextLoopStartS = nowTime + this.curentLoop.getBodyS();
                this.curentLoop.addCanvas(60 / this.beatLengthS);
                this.curentLoop = this.curentLoop.nextLoop();
                this.curentLoop.startRecording(nowTime);
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
    addFirstLoop(loop) {
        const nowTimeS = this.audioCtx.currentTime;
        if (this.loops.length > 0) {
            throw new Error('Already started playing.');
        }
        Log_1.Log.info(`Adding loop; playing: ${this.playingLoops.length}`);
        this.setTempo(loop.getBodyS());
        this.startTimeS = nowTimeS;
        this.scheduledThroughS = nowTimeS;
        loop.startSample(this.startTimeS);
        this.schedule();
        this.render();
        this.loops.push(loop);
    }
    setTempo(durationS) {
        this.loopLengthS = durationS;
        let beatLengthS = durationS;
        while (beatLengthS < 0.5) {
            beatLengthS *= 2;
        }
        while (beatLengthS > 1.0) {
            beatLengthS /= 2;
        }
        this.beatLengthS = beatLengthS;
        Log_1.Log.info(`Beats per minute: ${60 / beatLengthS}`);
    }
    render() {
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
        }
        else if (this.loopMode == 'play') {
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
    onTopOfLoop(audioTimstampS) {
        Log_1.Log.info('Top of loop...');
        this.curentLoop.stopRecording(audioTimstampS);
        if (this.loopMode === 'overdub') {
            this.loops.push(this.curentLoop);
            this.curentLoop.addCanvas(60 / this.beatLengthS);
            this.loopMode = 'play';
        }
        this.curentLoop = this.curentLoop.nextLoop();
        this.curentLoop.startRecording(audioTimstampS);
    }
    schedule() {
        if (this.audioCtx.currentTime + LoopManager.scheduleAheadS <
            this.scheduledThroughS) {
            // Nothing to do.  We are scheduled up through our schedule ahead buffer.
            setTimeout(() => { this.schedule(); }, 100);
            return;
        }
        const nextScheduleThroughS = this.scheduledThroughS + LoopManager.scheduleAheadS;
        if (this.audioCtx.currentTime + LoopManager.scheduleAheadS >
            this.nextLoopStartS) {
            this.onTopOfLoop(this.nextLoopStartS);
            for (const l of this.loops) {
                l.startSample(this.nextLoopStartS);
            }
            this.nextLoopStartS += this.loopLengthS;
        }
        this.scheduledThroughS = nextScheduleThroughS;
        setTimeout(() => { this.schedule(); }, 100);
    }
}
exports.LoopManager = LoopManager;
LoopManager.scheduleAheadS = 0.5;
//# sourceMappingURL=loopManager.js.map

/***/ }),

/***/ 96:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.LoopViz = void 0;
class LoopViz {
    static getPeaks(buffer, samplesPerPeak, offset) {
        const result = [];
        let m = 0;
        for (let i = offset; i < buffer.length; ++i) {
            result.push(m);
            const nextI = Math.min(buffer.length, i + samplesPerPeak);
            m = 0;
            while (i < nextI) {
                m = Math.max(m, Math.pow(Math.abs(buffer[i]), 0.5));
                ++i;
            }
        }
        return result;
    }
    static render(samples, sampleRate, bpm, headerS, canvas) {
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
        const peaks = this.getPeaks(samples, samplesPerPeak, Math.round(headerS * sampleRate));
        ctx.beginPath();
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const r = Math.min(cx, cy);
        ctx.moveTo(cx, cy);
        let t = Math.PI / 2; // Start downward.
        for (let x = 0; x < peaks.length; ++x) {
            ctx.lineTo(cx + Math.cos(t) * r * peaks[x], cy + Math.sin(t) * r * peaks[x]);
            t += radiansPerPeak;
        }
        console.log(t);
        ctx.lineTo(cx, cy);
        ctx.fill();
        ctx.stroke();
    }
}
exports.LoopViz = LoopViz;
//# sourceMappingURL=loopViz.js.map

/***/ }),

/***/ 930:
/***/ (function(__unused_webpack_module, exports) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SampleSource = void 0;
class SampleSource {
    constructor(audio) {
        this.firstChunkSize = 0;
        this.firstChunk = null;
        this.listeners = new Map();
        this.audio = audio;
        this.audioCtx = audio.audioCtx;
    }
    static make(audio) {
        const self = new SampleSource(audio);
        console.log("Attempting to initialize.");
        console.assert(!!navigator.mediaDevices.getUserMedia);
        var constraints = {
            audio: true,
            video: false,
            echoCancellation: false,
            noiseSuppersion: false,
        };
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const stream = yield navigator.mediaDevices.getUserMedia(constraints);
            self.handleStream(stream, resolve);
        }));
    }
    addListener(source, callback) {
        this.listeners.set(source, callback);
    }
    removeListener(source) {
        this.listeners.delete(source);
    }
    setUpAnalyser(mediaSource) {
        const body = document.getElementsByTagName('body')[0];
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        body.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const analyser = this.audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        this.mediaSource.connect(analyser);
        const dataArray = new Float32Array(analyser.frequencyBinCount);
        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            analyser.getFloatTimeDomainData(dataArray);
            let m = 0;
            let s = 0;
            for (let i = 0; i < dataArray.length; ++i) {
                const v = Math.pow(Math.abs(dataArray[i]), 0.3);
                m = Math.max(m, v);
                s += v;
            }
            const thetaMax = Math.PI * m;
            const thetaMean = Math.PI * s / dataArray.length;
            const start = Math.PI / 2;
            ctx.beginPath();
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#44f';
            ctx.lineWidth = 25;
            ctx.arc(50, 50, 30, start - thetaMean, start + thetaMean);
            ctx.stroke();
            ctx.beginPath();
            ctx.strokeStyle = '#f48';
            ctx.lineWidth = 5;
            ctx.arc(50, 50, 30, start - thetaMax, start + thetaMax);
            ctx.stroke();
            requestAnimationFrame(render);
        };
        requestAnimationFrame(render);
    }
    handleStream(stream, resolve) {
        this.mediaSource = this.audioCtx.createMediaStreamSource(stream);
        this.setUpAnalyser(this.mediaSource);
        var options = {
            mimeType: "audio/webm;codecs=pcm",
        };
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
        }
        this.mediaRecorder = new MediaRecorder(stream, options);
        this.mediaRecorder.onstart = (e) => {
            console.log(`Media stream start ${stream.id}`);
        };
        this.mediaRecorder.onstop = (e) => {
            this.decodeChunk(e.data);
            this.mediaRecorder = null;
        };
        this.mediaRecorder.ondataavailable = (e) => {
            this.decodeChunk(e.data);
        };
        this.mediaRecorder.start(/*timeslice=*/ 500 /*ms*/);
        console.log(`Initialized @ ${this.audioCtx.currentTime}`);
        resolve(this);
    }
    maxOfArray(a) {
        let m = a[0];
        for (const x of a) {
            m = Math.max(m, x);
        }
        return m;
    }
    decodeChunk(chunk) {
        let chunkEndTime = this.audioCtx.currentTime;
        let fileReader = new FileReader();
        fileReader.onloadend = () => {
            const encodedData = fileReader.result;
            // console.log("Encoded length: " + encodedData.byteLength);
            this.audioCtx.decodeAudioData(encodedData, (decodedSamples) => {
                // TODO: Consider supporting stereo or more channels.
                let newSamples = decodedSamples.getChannelData(0)
                    .slice(this.firstChunkSize, decodedSamples.length);
                if (newSamples.length > 0) {
                    for (const listener of this.listeners.values()) {
                        setTimeout(() => { listener(newSamples, chunkEndTime); }, 0);
                    }
                }
                if (this.firstChunkSize == 0) {
                    this.firstChunkSize = decodedSamples.length;
                }
            }, (er) => {
                console.error(er);
            });
        };
        let blob;
        if (!this.firstChunk) {
            this.firstChunk = chunk;
            blob = new Blob([chunk], { 'type': chunk.type });
        }
        else {
            blob = new Blob([this.firstChunk, chunk], { 'type': chunk.type });
        }
        fileReader.readAsArrayBuffer(blob);
    }
}
exports.SampleSource = SampleSource;
//# sourceMappingURL=sampleSource.js.map

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		if(__webpack_module_cache__[moduleId]) {
/******/ 			return __webpack_module_cache__[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	// startup
/******/ 	// Load entry module
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	__webpack_require__(138);
/******/ })()
;
//# sourceMappingURL=main.js.map