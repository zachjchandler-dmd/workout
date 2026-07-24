// Workout skip logger — Cloudflare Worker
// Receives a skip note from the plan page and saves it as a file in the
// GitHub repo (skips/<id>.json). The nightly task reads and applies these.
// The GitHub token is stored as the secret GH_TOKEN (never in the page).

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") {
      return new Response("Workout skip logger is running.", { headers: cors });
    }

    let body;
    try { body = await request.json(); } catch (e) {
      return json({ ok: false, error: "bad json" }, 400, cors);
    }
    const note = String(body.note || "").slice(0, 300);
    // light guard so the endpoint only accepts genuine skip notes
    if (!/training log/i.test(note)) {
      return json({ ok: false, error: "rejected" }, 400, cors);
    }

    const owner = "zachjchandler-dmd";
    const repo = "workout";
    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const path = "skips/" + id + ".json";
    const payload = JSON.stringify({ note: note, at: new Date().toISOString() });

    const res = await fetch(
      "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path,
      {
        method: "PUT",
        headers: {
          "Authorization": "Bearer " + env.GH_TOKEN,
          "Accept": "application/vnd.github+json",
          "User-Agent": "workout-skip-logger",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Skip logged via page",
          content: btoa(payload),
          committer: { name: "Claude", email: "noreply@anthropic.com" },
          author: { name: "Claude", email: "noreply@anthropic.com" },
        }),
      }
    );

    if (!res.ok) {
      const t = await res.text();
      return json({ ok: false, error: "github " + res.status, detail: t.slice(0, 200) }, 502, cors);
    }
    return json({ ok: true }, 200, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: Object.assign({ "Content-Type": "application/json" }, cors),
  });
}
