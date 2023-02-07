import { BrowserRouter } from "react-router-dom";
import GlobalStyle from "styles/GlobalStyle";
import Router from "./Router";
import "bootstrap/dist/css/bootstrap.min.css";

function App() {
    return (
        <BrowserRouter>
            <GlobalStyle />
            <Router />
        </BrowserRouter>
    );
}

export default App;
