// 해당 클래스는 PCM을 전달하기 위한 최소한의 기능만 담당한다.
class RecordingProcessor extends AudioWorkletProcessor {
    // parameter 수정 시, static get parameterDescriptors() 사용

    constructor(options) {
        super();
        // 주로 { numberOfChannels: 1(mono), sampleRate: 16000 } 사용됨
        if (options && options.processorOptions) {
            const { numberOfChannels, sampleRate, maxFrameCount } = options.processorOptions;
            this.sampleRate = sampleRate;
            this.numberOfChannels = numberOfChannels;
            this.maxRecordingFrames = maxFrameCount; // 최대 녹음 가능 길이
        }

        this.isRecording = false;

        // PCM Data를 담을 최대 공간
        this.recordingBuffer = new Array(this.numberOfChannels).fill(new Float32Array(this.maxRecordingFrames));
        // 녹음된 프레임(길이)
        this.recordedFrames = 0;

        // 상태 전달을 위한 타이머 (60hz)
        this.framesSinceLastPublish = 0;
        this.publishInterval = this.sampleRate / 60;

        // this.sampleSum = 0;

        // 외부 -> 프로세서 메시지 수신 처리
        this.port.onmessage = (event) => {
            switch (event.data.message) {
                case "UPDATE_RECORDING_STATE":
                    this.isRecording = event.data.isRecording;
                    console.log("%c[App] %c-> %c[Processor]", "color: #FFC700; font-weight: 700", "", "color: pink; font-weight: 700", {
                        message: event.data.message,
                        isRecording: event.data.isRecording,
                    });

                    if (!this.isRecording) {
                        this.shareRecordingBuffer();
                    }
                    break;
                default:
            }
        };

        console.log("🆕 Processor Initialized", {
            sampleRate: this.sampleRate,
            channels: this.numberOfChannels,
            timeout: this.maxRecordingFrames / this.sampleRate,
        });
    }

    // 반드시 구현해야 하는 메서드
    // 들어오는 오디오 데이터를 받고 프로세서에 의해 조작된 데이터를 출력에 넣을 수 있다.
    // boolean 반환값을 통해 노드를 살려둘 지 말 지 결정할 수 있다.
    process(inputs, outputs, params) {
        const input = inputs[0];
        for (let channel = 0; channel < this.numberOfChannels; channel++) {
            for (let sample = 0; sample < input[channel].length; sample++) {
                const currentSample = input[channel][sample];

                // Copy data to recording buffer.
                if (this.isRecording) {
                    this.recordingBuffer[channel][sample + this.recordedFrames] = currentSample;
                }

                // this.sampleSum += currentSample;
                
                // output에 Raw 데이터를 넣으면 바로 스피커로 출력된다. (실시간 출력)
                // outputs[input][channel][sample] = currentSample;
            }
        }

        const shouldPublish = this.framesSinceLastPublish >= this.publishInterval;

        if (this.isRecording) {
            if (this.recordedFrames + 128 < this.maxRecordingFrames) {
                // 녹음 가능 시간 timeout 시

                this.recordedFrames += 128;

                // Post a recording recording length update on the clock's schedule
                if (shouldPublish) {
                    const message = {
                        message: "UPDATE_RECORDING_STATE",
                        recordingLength: this.recordedFrames,
                        recordingTime: Math.round((this.recordedFrames / this.sampleRate) * 100) / 100,
                        // gain: this.sampleSum / this.framesSinceLastPublish,
                    };

                    this.framesSinceLastPublish = 0;
                    // this.sampleSum = 0;

                    this.port.postMessage(message);
                    console.log("%c[Processor] %c-> %c[App]", "color: pink; font-weight: 700", "", "color: #FFC700; font-weight: 700", message);
                } else {
                    this.framesSinceLastPublish += 128;
                }
            } else {
                // 녹음 가능 시간 timeout 초과 시
                this.isRecording = false;
                this.port.postMessage({
                    message: "MAX_RECORDING_LENGTH_REACHED",
                });
                this.shareRecordingBuffer();

                return false;
            }
        }

        return true;
    }

    // 현재까지 녹음한 버퍼를 App에 전달
    shareRecordingBuffer() {
        const message = {
            message: "SHARE_RECORDING_BUFFER",
            buffer: this.recordingBuffer.map((buffer) => buffer.slice(0, this.recordedFrames + 128)),
        };
        this.port.postMessage(message);
        console.log("%c[Processor] %c-> %c[App]", "color: pink; font-weight: 700", "", "color: #FFC700; font-weight: 700", message);
    }
}

// 새로운 오디오 worklet 프로세서 등록
registerProcessor("recording-processor", RecordingProcessor);