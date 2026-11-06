import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import { paymentMiddleware } from "@x402/hono";
import { Hono } from "hono";
import { runCheck } from "./check.js";
import { agentRegistration } from "./identity.js";
import { InputError, parseQuery } from "./parse.js";
import { checkRoutes, statusBody } from "./seller.js";
import { FACILITATOR_URL, type Settings } from "./settings.js";

export function createApp(settings: Settings) {
  const app = new Hono();

  app.get("/api/status", (c) => c.json(statusBody(settings)));
  app.get("/api/agent.json", (c) => c.json(agentRegistration(settings)));

  if (settings.paymentMode === "x402") {
    if (!settings.payTo) {
      app.post("/api/check", (c) =>
        c.json({ error: "PAYMENT_MODE=x402 needs PAY_TO or AGENT_PRIVATE_KEY." }, 503),
      );
      return app;
    }
    const headers: Record<string, string> = {};
    if (settings.x402ApiKey) headers["X-API-Key"] = settings.x402ApiKey;
    const facilitator = new HTTPFacilitatorClient({
      url: FACILITATOR_URL,
      createAuthHeaders: async () => ({ verify: headers, settle: headers, supported: headers }),
    });
    const server = new x402ResourceServer(facilitator)
      .register("eip155:42220", new ExactEvmScheme())
      .registerExtension(bazaarResourceServerExtension);
    app.use(paymentMiddleware(checkRoutes(settings), server));
  }

  app.post("/api/check", async (c) => {
    let body: { query?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Send JSON { query }." }, 400);
    }
    if (typeof body.query !== "string") return c.json({ error: "query must be a string." }, 400);
    try {
      const report = await runCheck(parseQuery(body.query), settings);
      console.log(
        JSON.stringify({
          event: "check",
          id: report.id,
          risk: report.risk,
          mode: report.mode,
          receipts: report.receipts.length,
        }),
      );
      return c.json(report);
    } catch (error) {
      if (error instanceof InputError) return c.json({ error: error.message }, 400);
      const message = error instanceof Error ? error.message : "Check failed";
      const status = /catalog|Nothing was spent|AGENT_PRIVATE_KEY/.test(message) ? 503 : 500;
      console.log(JSON.stringify({ event: "check_error", message }));
      return c.json({ error: message }, status);
    }
  });

  return app;
}
