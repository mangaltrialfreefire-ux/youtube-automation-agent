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
