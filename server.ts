import express from "express";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy routes
  app.post("/api/proxy", async (req, res) => {
    const { url, body } = req.body;
    console.log(`Proxying request to: ${url}`);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Proxy fetch failed for ${url}: ${response.status} ${response.statusText} - ${errorText}`);
        return res.status(response.status).json({ error: `Proxy fetch failed: ${response.statusText}`, details: errorText });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error(`Proxy internal error for ${url}:`, error);
      res.status(500).json({ error: 'Proxy failed', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
