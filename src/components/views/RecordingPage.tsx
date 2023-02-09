import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Button from "react-bootstrap/Button";
import useRecord from 'hooks/useRecord';
import { Box } from "styles/layout";

const RecordingPage = () => {
    const navigate = useNavigate();
    const { isRecording, audio, time, bufferArray, record, stop } = useRecord({
        sampleRate: 48000,
        channel: 1,
        timeout: 5,
    });

    
    return (
        <Box>
            <audio className='mb-4' src={audio ?? url} style={{ display: audio ? "block" : "none" }} controls />
            <div className='mb-4'>{time}</div>
            <Button variant={!isRecording ? "outline-danger" : "outline-dark"} className='mb-4' onClick={!isRecording ? () => record() : () => stop()}>
                {!isRecording ? "🎙️ 녹음하기" : "🛑 중단하기"}
            </Button>
            <Button variant="outline-warning" onClick={() => navigate("/")}>🏠 돌아가기</Button>
        </Box>
    );
};

const url = "https://api.twilio.com//2010-04-01/Accounts/AC25aa00521bfac6d667f13fec086072df/Recordings/RE6d44bc34911342ce03d6ad290b66580c.mp3";

export default RecordingPage;