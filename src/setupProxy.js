const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  console.log('🔧 正在加载代理配置...');
  
  // 飞书API代理
  app.use(
    '/feishu-api',
    createProxyMiddleware({
      target: 'https://open.feishu.cn',
      changeOrigin: true,
      secure: true,
      pathRewrite: {
        '^/feishu-api': '/open-apis'
      },
      logLevel: 'debug',
      onProxyReq: (proxyReq, req, res) => {
        console.log(`🚀 代理请求: ${req.method} ${req.originalUrl} -> ${proxyReq.protocol}//${proxyReq.getHeader('host')}${proxyReq.path}`);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log(`✅ 代理响应: ${proxyRes.statusCode} ${req.originalUrl}`);
      },
      onError: (err, req, res) => {
        console.error(`❌ 代理错误: ${err.message} for ${req.originalUrl}`);
        res.writeHead(500, {
          'Content-Type': 'text/plain'
        });
        res.end('代理错误: ' + err.message);
      }
    })
  );
  
  console.log('✅ 代理配置加载完成');
}; 