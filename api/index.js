const { GeminiCreativeService } = require('../utils/gemini-creative-service');

let creativeService = null;
function getCreative() {
  if (!creativeService) {
    creativeService = new GeminiCreativeService();
  }
  return creativeService;
}

module.exports = async (req, res) => {
  // CORS headers for cross-origin access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse JSON body if needed
  let body = req.body;
  if (typeof body === 'string' && body.length > 0) {
    try {
      body = JSON.parse(body);
    } catch (_) {
      // ignore
    }
  }

  // 1. If RAILWAY_URL is configured, proxy request to Railway backend
  const railwayUrl = process.env.RAILWAY_URL || process.env.RAILWAY_BACKEND_URL;
  if (railwayUrl) {
    try {
      const targetUrl = railwayUrl.replace(/\/+$/, '') + req.url;
      const headers = { ...req.headers };
      delete headers.host;
      delete headers.connection;

      const fetchOptions = {
        method: req.method,
        headers
      };
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && body) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const proxyRes = await fetch(targetUrl, fetchOptions);
      res.status(proxyRes.status);
      proxyRes.headers.forEach((val, key) => res.setHeader(key, val));
      const buffer = Buffer.from(await proxyRes.arrayBuffer());
      return res.send(buffer);
    } catch (err) {
      console.warn('Proxy to Railway failed:', err.message);
    }
  }

  // 2. Health check route
  if (req.url === '/health' || req.url === '/api/health') {
    return res.json({
      status: 'healthy',
      frontend: 'vercel',
      railwayConnected: Boolean(railwayUrl),
      timestamp: new Date().toISOString()
    });
  }

  // 3. Creative Studio endpoints (Veo 3, Google Search Grounding, Image, Music)
  if (
    req.url.startsWith('/api/creative/') ||
    req.url === '/api/generate-video' ||
    req.url === '/api/search-grounding' ||
    req.url === '/api/generate-image' ||
    req.url === '/api/generate-music'
  ) {
    const creative = getCreative();
    try {
      if (req.url === '/api/creative/video' || req.url === '/api/generate-video') {
        const result = await creative.startVideoGeneration(body || {});
        return res.json({ success: true, ...result });
      }
      if (req.url === '/api/creative/video-status' || req.url === '/api/video-status') {
        const opName = body?.operationName || req.query?.operationName;
        const result = await creative.getVideoStatus(opName);
        return res.json({ success: true, ...result });
      }
      if (req.url.startsWith('/api/creative/video-proxy') || req.url.startsWith('/api/video-download')) {
        const opName = body?.operationName || req.query?.operationName;
        const status = await creative.getVideoStatus(opName);
        if (!status.done || !status.videoUri) {
          return res.status(404).json({ success: false, error: 'Video not ready' });
        }
        const apiKey = process.env.GEMINI_API_KEY;
        const vRes = await fetch(status.videoUri, {
          headers: apiKey ? { 'x-goog-api-key': apiKey } : {}
        });
        res.setHeader('Content-Type', 'video/mp4');
        return res.send(Buffer.from(await vRes.arrayBuffer()));
      }
      if (req.url === '/api/creative/search-grounding' || req.url === '/api/search-grounding') {
        const result = await creative.searchGrounding(body || {});
        return res.json({ success: true, result });
      }
      if (req.url === '/api/creative/image' || req.url === '/api/generate-image' || req.url === '/api/edit-image') {
        const result = await creative.generateOrEditImage(body || {});
        return res.json({ success: true, result });
      }
      if (req.url === '/api/creative/music' || req.url === '/api/generate-music') {
        const result = await creative.generateMusic(body || {});
        return res.json({ success: true, result });
      }
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 4. Initial dashboard state fallback if Railway backend is not connected yet
  if (req.url === '/api/dashboard') {
    return res.json({
      system: {
        initialized: true,
        setupRequired: false,
        automationPaused: false,
        agents: ['ResearchAgent', 'ProductionAgent', 'ReviewAgent', 'AnalyticsAgent']
      },
      stats: { totalVideos: 0, pendingReviews: 0, scheduled: 0, published: 0 },
      jobs: [],
      pipeline: [],
      schedule: [],
      events: [],
      notifications: [],
      profile: { channelName: 'YouTube Automation Channel' },
      settings: { videoProvider: 'google_omni' },
      ideas: [],
      analytics: { totalVideos: 0, averagePerformanceScore: 0, topPerformers: [] },
      learning: null,
      activation: { completed: true },
      channelStrategy: null,
      operatorRuns: [],
      readiness: { status: 'healthy', checks: [] },
      engagement: [],
      experiments: []
    });
  }

  // 5. Default fallback
  return res.json({
    success: true,
    message: 'Vercel frontend is running. Connect your Railway live backend in Settings for full autonomous channel operation.'
  });
};
