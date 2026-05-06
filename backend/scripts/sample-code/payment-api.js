// GCP Cloud Run: payment-api
// Memory: 512 MB | minInstances: 1 | Invocations/mo: 1.2M | p95: 240ms
//
// Sample handler with cost-impacting code patterns the agent should flag.

const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

app.post("/charge", async (req, res) => {
  // Each request opens a fresh TCP+TLS connection to api.stripe.com.
  // Using a global Agent with keepAlive saves the handshake cost on every call.
  const stripeRes = await fetch("https://api.stripe.com/v1/charges", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req.body),
  });

  // These two upstream calls are independent but awaited in sequence,
  // doubling the request's user-visible latency.
  const userRes = await fetch(`https://api.users.internal/lookup/${req.body.userId}`);
  const fraudRes = await fetch(`https://api.fraud.internal/check/${req.body.orderId}`);

  // Loads the entire fraud catalog response (~12 MB) just to find one entry.
  const fraudData = await fraudRes.json();
  const matchedRule = fraudData.rules.find(r => r.orderId === req.body.orderId);

  // No timeout on any of the upstream fetches — a slow upstream stalls the
  // Cloud Run instance, increasing min-instance hours billed.
  res.json({
    chargeId: (await stripeRes.json()).id,
    user: await userRes.json(),
    fraudMatch: matchedRule,
  });
});

app.listen(8080);
