import { useNavigate } from "react-router-dom";
import Button from "react-bootstrap/Button";
import { Box } from "styles/layout";

const HomePage = () => {
    const navigate = useNavigate();

    return (
        <Box>
            <Button onClick={() => navigate("/record")} style={{ fontWeight: 600 }}>Record</Button>
        </Box>
    );
};

export default HomePage;