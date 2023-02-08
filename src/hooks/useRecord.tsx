import { useState, useEffect } from "react";
import createLinkFromAudioBuffer from "utils/exporter";

interface Options {
    sampleRate: number;
    channel: number;
    timeout: number;
}

// recording-processor를 통해 녹음을 진행하고, 녹음 버퍼를 얻는 역할까지만 동작하는 훅
const useRecord = (option: Options) => {
    const [context, setContext] = useState<AudioContext | null>(null);
    const [source, setSource] = useState<MediaStreamAudioSourceNode | null>(null);
    const [processor, setProcessor] = useState<AudioWorkletNode | null>(null);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [audio, setAudio] = useState<string | null>(null);
    const [time, setTime] = useState(0);

    let recordingLength: number;

    useEffect(() => {
        init();

        return () => {
            context?.close();
            source?.disconnect();
            processor?.disconnect();

            setContext(null);
            setSource(null);
            setProcessor(null);
        }
    }, []);

    const init = async () => {
        const context = new AudioContext({
            sampleRate: option?.sampleRate ?? 48000,
        });
        
        const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                autoGainControl: false,
                noiseSuppression: true,
                latency: 0,
            },
        });

        const micSource = context.createMediaStreamSource(micStream);

        console.log(micSource);

        await context.audioWorklet.addModule("recording-processor.js");
        // .then()으로 하단 내용들 묶어 넣기
        // 묶어 넣기 대상 1
        const recordingNode = new AudioWorkletNode(context, "recording-processor", {
            processorOptions: {
                numberOfChannels: option.channel,
                sampleRate: context.sampleRate,
                maxFrameCount: context.sampleRate * (option?.timeout ?? 5),
            },
        });

        const monitorNode = context.createGain();
        // 묶어 넣기 대상 2
        recordingNode.port.onmessage = (event) => {
            switch (event.data.message) {
                case "UPDATE_RECORDING_STATE": {
                    recordingLength = event.data.recordingLength;
                    setTime(event.data.recordingTime);
                    break;
                }
                case "SHARE_RECORDING_BUFFER": {
                    /**
                     * Error => Uncaught DOMException: Failed to execute 'createBuffer' on 'BaseAudioContext': The number of frames provided (0) is less than or equal to the minimum bound (0).
                     * Solution => recordingLength !== 0
                     */
                    console.log(event.data.buffer); // 2채널

                    const recordingBuffer = context.createBuffer(
                        option.channel,
                        recordingLength,
                        context.sampleRate
                    );
                    
                    for (let i = 0; i < option.channel; i++) {
                        recordingBuffer.copyToChannel(event.data.buffer[i], i, 0);
                    }

                    setAudio(createLinkFromAudioBuffer(recordingBuffer, true));

                    break;
                }
                case "MAX_RECORDING_LENGTH_REACHED": {
                    setIsRecording(false);
                    break;
                }
                default:
            }
        };

        micSource.connect(recordingNode).connect(monitorNode).connect(context.destination);
        
        setContext(context);
        setSource(micSource);
        setProcessor(recordingNode);
    }

    const record = () => {
        setIsRecording(true);

        processor?.port.postMessage({
            message: "UPDATE_RECORDING_STATE",
            isRecording: true,
        });
    };

    const pause = () => {
        setIsRecording(false);

        processor?.port.postMessage({
            message: "UPDATE_RECORDING_STATE",
            isRecording: false,
        });
    };

    return { isRecording, time, audio, record, pause };
};

export default useRecord;

/*
    let audioContext = null;

    async function createMyAudioProcessor() {
        if (!audioContext) {
            try {
                audioContext = new AudioContext();
                await audioContext.resume();
                await audioContext.audioWorklet.addModule("module-url/module.js");
            } catch(e) {
                return null;
            }
        }

        return new AudioWorkletNode(audioContext, "processor-name");
    }


*/