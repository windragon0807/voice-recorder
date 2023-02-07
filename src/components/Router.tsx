import { Routes, Route } from "react-router-dom";
import HomePage from "components/views/HomePage";
import RecordingPage from "components/views/RecordingPage";

const Router = () => {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/record" element={<RecordingPage />} />
        </Routes>
    );
};

export default Router;
