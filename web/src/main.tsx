import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { CheckApp } from "./check-app"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CheckApp />
  </StrictMode>,
)
