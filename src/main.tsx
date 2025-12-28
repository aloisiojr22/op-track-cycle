import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

console.log("Starting application...");

try {
  createRoot(rootElement).render(<App />);
} catch (error) {
  console.error("Failed to render app:", error);
  rootElement.innerHTML = `<div style="padding: 20px; font-family: sans-serif; color: #d32f2f;">
    <h1>Erro ao carregar aplicação</h1>
    <p>${error instanceof Error ? error.message : 'Erro desconhecido'}</p>
    <p>Verifique as variáveis de ambiente no Netlify.</p>
  </div>`;
}
