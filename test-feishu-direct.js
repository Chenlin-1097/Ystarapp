const https = require('https');

// 飞书配置
const FEISHU_CONFIG = {
  APP_ID: 'cli_a74001f855b0d00c',
  APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq', // 使用完整的密钥
  BASE_URL: 'https://open.feishu.cn/open-apis'
};

// 直接测试飞书API认证
async function testFeishuAuth() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      app_id: FEISHU_CONFIG.APP_ID,
      app_secret: FEISHU_CONFIG.APP_SECRET
    });

    const options = {
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    console.log('🚀 直接测试飞书API认证...');
    console.log('📡 请求配置:', {
      url: `https://${options.hostname}${options.path}`,
      method: options.method,
      headers: options.headers
    });

    const req = https.request(options, (res) => {
      console.log('📊 响应状态码:', res.statusCode);
      console.log('📊 响应头:', res.headers);

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('📊 原始响应内容:', data);
        
        try {
          const jsonData = JSON.parse(data);
          console.log('✅ 解析后的JSON:', jsonData);
          
          if (jsonData.code === 0) {
            console.log('🎉 认证成功！');
            console.log('🔑 访问令牌:', jsonData.tenant_access_token);
            resolve(jsonData);
          } else {
            console.log('❌ 认证失败:', jsonData.msg);
            reject(new Error(jsonData.msg));
          }
        } catch (parseError) {
          console.error('❌ JSON解析错误:', parseError.message);
          console.error('❌ 响应内容不是有效JSON:', data);
          reject(parseError);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ 请求错误:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// 测试函数
async function runTest() {
  try {
    console.log('='.repeat(50));
    console.log('🔍 开始直接测试飞书API...');
    console.log('='.repeat(50));
    
    const result = await testFeishuAuth();
    console.log('🎊 测试完成，结果:', result);
    
  } catch (error) {
    console.error('💥 测试失败:', error.message);
  }
}

// 运行测试
runTest(); 