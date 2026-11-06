import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./app.js";
import { settingsFromEnv } from "./settings.js";

const settings = settingsFromEnv(process.env);
const app = createApp(settings);
app.use("/*", serveStatic({ root: "./public" }));

serve({ fetch: app.fetch, port: settings.port }, (info) => {
  console.log(
    JSON.stringify({
      event: "listen",
      port: info.port,
      mode: settings.buyMode,
      payment: settings.paymentMode,
      payTo: settings.payTo ?? null,
      attributionCode: settings.attributionCode,
    }),
  );
});
