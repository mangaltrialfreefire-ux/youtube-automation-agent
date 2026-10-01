const { YouTubeAutomationAgent } = require('../index');

let agentInstance = null;
let initPromise = null;

async function getAgent() {
  if (!agentInstance) {
    if (!initPromise) {
      const agent = new YouTubeAutomationAgent();
      initPromise = agent.initialize().then(() => {
        agentInstance = agent;
        return agent;
      });
    }
    await initPromise;
  }
  return agentInstance;
}

module.exports = async (req, res) => {
  try {
    const railwayUrl = process.env.RAILWAY_URL || process.env.RAILWAY_BACKEND_URL;
    if (railwayUrl && req.url.startsWith('/api')) {
      const targetUrl = railwayUrl.replace(/\/+$/, '') + req.url;
      const headers = { ...req.headers };
      delete headers.host;
      const fetchOptions = {
        method: req.method,
        headers
      };
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }
      const proxyRes = await fetch(targetUrl, fetchOptions);
      res.status(proxyRes.status);
      proxyRes.headers.forEach((val, key) => res.setHeader(key, val));
      const buffer = Buffer.from(await proxyRes.arrayBuffer());
      return res.send(buffer);
    }

    const agent = await getAgent();
    return agent.app(req, res);
  } catch (error) {
    console.error('Vercel function invocation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
