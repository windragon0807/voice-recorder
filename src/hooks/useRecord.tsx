import { useState, useEffect, useRef } from "react";
import createLinkFromAudioBuffer from "utils/exporter";

interface Options {
    sampleRate: number;
    channel: number;
    timeout: number;
}

// 필요한 요소들을 해당 훅에서 가공해서 추가
interface Returns {
    isRecording: boolean; // 녹음 중 여부
    time: number; // 녹음 경과 시간
    audio: string | null; // Blob 오디오 소스
    rms: number;
    bufferArray: Float32Array[] | null; // Pcm 데이터 배열
    record: () => void; // 녹음 실행
    pause: () => void; // 녹음 중지
    stop: () => void; // 녹음 종료
}

// recording-processor를 통해 녹음을 진행하고, 녹음 버퍼를 얻는 역할까지만 동작하는 훅
const useRecord = (option: Partial<Options>): Returns => {
    const audioContext = useRef<AudioContext | null>(null);
    const source = useRef<MediaStreamAudioSourceNode | null>(null);
    const processor = useRef<AudioWorkletNode | null>(null);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [time, setTime] = useState<number>(0);
    const [audio, setAudio] = useState<string | null>(null);
    const [bufferArray, setBufferArray] = useState<Float32Array[] | null>(null);
    const recordedSize = useRef<number>(0);
    const analyser = useRef<AnalyserNode | null>(null);
    const [rms, setRms] = useState<number>(0);

    useEffect(() => {
        init();

        return () => {
            audioContext.current?.close();
            source.current?.disconnect();
            processor.current?.disconnect();

            audioContext.current = null;
            source.current = null;
            processor.current = null;
            analyser.current = null;
        }
    }, []);

    const init = async () => {
        const context = new AudioContext({
            sampleRate: option?.sampleRate ?? 16000,
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
        const channelCount = option?.channel ?? micSource.channelCount;
        const monitorNode = context.createGain();
        const analyserNode = context.createAnalyser();

        await context.audioWorklet.addModule("recording-processor.js");
        const node = new AudioWorkletNode(context, "recording-processor", {
            processorOptions: {
                numberOfChannels: channelCount,
                sampleRate: context.sampleRate,
                maxFrameCount: context.sampleRate * (option?.timeout ?? 5),
            },
        });
        node.port.onmessage = ({ data }: MessageEvent) => {
            switch (data.message) {
                case "UPDATE_RECORDING_STATE": {
                    recordedSize.current = data.recordedSize;
                    setTime(data.recordingTime);
                    setRms(data.rms*1);
                    break;
                }
                case "SHARE_RECORDING_BUFFER": {
                    setBufferArray(data.buffer);

                    const recordingBuffer = context.createBuffer(
                        channelCount,
                        recordedSize.current,
                        context.sampleRate,
                    );
                    
                    for (let i = 0; i < channelCount; i++) {
                        recordingBuffer.copyToChannel(data.buffer[i], i, 0);
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

        micSource.connect(node).connect(monitorNode).connect(analyserNode).connect(context.destination);
        analyserNode.connect(node);

        audioContext.current = context;
        source.current = micSource;
        processor.current = node;
        analyser.current = analyserNode;
    }

    const record = () => {
        setIsRecording(true);

        processor.current?.port.postMessage({
            message: "UPDATE_RECORDING_STATE",
            isRecording: true,
            state: "record",
        });
    };

    const pause = () => {
        setIsRecording(false);

        processor.current?.port.postMessage({
            message: "UPDATE_RECORDING_STATE",
            isRecording: false,
            state: "pause",
        });
    };

    const stop = () => {
        setIsRecording(false);
        setRms(0);
        processor.current?.port.postMessage({
            message: "UPDATE_RECORDING_STATE",
            isRecording: false,
            state: "stop",
        });
    }

    return { isRecording, time, audio, rms, bufferArray, record, pause, stop };
};

export default useRecord;