import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { ProofApp } from "./proof-app"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProofApp />
  </StrictMode>,
)
