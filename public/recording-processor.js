class RecordingProcessor extends AudioWorkletProcessor {
    #isRecording = false;
    #sampleRate = 16_000;
    #numberOfChannels = 1;
    #maxRecordingFrames = 16_000 * 10; // 최대 녹음 가능 길이
    #recordingBuffer; // PCM Data를 담을 공간
    #recordedFrames = 0; // 녹음된 프레임(길이)
    #framesSinceLastPublish = 0;
    #publishInterval = this.#sampleRate / 60; // 상태 전달 주기 (60hz)
    #rmsSum = 0;
    
    constructor(options) {
        super();

        if (options && options.processorOptions) {
            const { numberOfChannels, sampleRate, maxFrameCount } = options.processorOptions;
            this.#sampleRate = sampleRate;
            this.#numberOfChannels = numberOfChannels;
            this.#maxRecordingFrames = maxFrameCount;
        }
        
        this.#recordingBuffer = new Array(this.#numberOfChannels).fill(new Float32Array(this.#maxRecordingFrames));
        
        // 외부 -> 프로세서 메시지 수신 처리
        this.port.onmessage = (event) => {
            switch (event.data.message) {
                case "UPDATE_RECORDING_STATE":
                    this.#isRecording = event.data.isRecording;
                    console.log("%c[App] %c-> %c[Processor]", "color: #FFC700; font-weight: 700", "", "color: pink; font-weight: 700", {
                        message: event.data.message,
                        isRecording: event.data.isRecording,
                    });
                    
                    if (!this.#isRecording) {
                        this.#shareRecordingBuffer();
                        
                        if (event.data.state === "stop") {
                            // 상태값 초기화
                            this.#recordingBuffer = new Array(this.#numberOfChannels).fill(new Float32Array(this.#maxRecordingFrames));
                            this.#recordedFrames = 0;
                            this.#framesSinceLastPublish = 0;
                        }
                    }
                    break;
                default:
            }
        };
        
        console.log("🆕 Processor Initialized", {
            sampleRate: this.#sampleRate,
            channels: this.#numberOfChannels,
            timeout: this.#maxRecordingFrames / this.#sampleRate,
        });
    }
    
    process(inputs, outputs, params) {
        const input = inputs[0];
        for (let channel = 0; channel < this.#numberOfChannels; channel++) {
            for (let sample = 0; sample < input[channel].length; sample++) {
                const currentSample = input[channel][sample];
                // Copy data to recording buffer.
                if (this.#isRecording) {
                    this.#recordingBuffer[channel][sample + this.#recordedFrames] = currentSample;
                    this.#rmsSum += currentSample ** 2;
                }
                // output에 Raw 데이터를 넣으면 실시간으로 스피커로 출력된다.
                // outputs[input][channel][sample] = currentSample;
            }
        }
        
        if (this.#isRecording) {
            if (this.#recordedFrames + 128 < this.#maxRecordingFrames) {
                // 녹음 가능 시간 timeout 시
                
                this.#recordedFrames += 128;
                
                if (this.#framesSinceLastPublish >= this.#publishInterval) {
                    const message = {
                        message: "UPDATE_RECORDING_STATE",
                        recordedSize: this.#recordedFrames,
                        recordingTime: Math.round((this.#recordedFrames / this.#sampleRate) * 100) / 100,
                        rms: (Math.sqrt(this.#rmsSum / this.#framesSinceLastPublish) * 10000).toFixed(2),
                    };
                    
                    this.#framesSinceLastPublish = 0;
                    this.#rmsSum = 0;
                    
                    this.port.postMessage(message);
                    console.log("%c[Processor] %c-> %c[App]", "color: pink; font-weight: 700", "", "color: #FFC700; font-weight: 700", message);
                } else {
                    this.#framesSinceLastPublish += 128;
                }
            } else {
                // 녹음 가능 시간 timeout 초과 시
                this.#isRecording = false;
                this.port.postMessage({
                    message: "MAX_RECORDING_LENGTH_REACHED",
                });
                this.#shareRecordingBuffer();
                
                return false;
            }
        }
        // true => 노드 유지, false => 노드 종료
        return true;
    }
    
    get currentBuffer() {
        return this.#recordingBuffer.map((buffer) => buffer.slice(0, this.#recordedFrames + 128));
    }
    
    // 현재까지 녹음한 버퍼를 App에 전달
    #shareRecordingBuffer(portMessage) {
        const message = {
            message: portMessage ?? "SHARE_RECORDING_BUFFER",
            buffer: this.currentBuffer,
        };
        this.port.postMessage(message);
        console.log("%c[Processor] %c-> %c[App]", "color: pink; font-weight: 700", "", "color: #FFC700; font-weight: 700", message);
    }
}

// 새로운 오디오 worklet 프로세서 등록
registerProcessor("recording-processor", RecordingProcessor);