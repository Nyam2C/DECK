import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/style.css";

function App() {
  return <div>DECK</div>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
