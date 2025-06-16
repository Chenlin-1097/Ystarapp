const axios = require('axios');

// 飞书配置
const FEISHU_CONFIG = {
  APP_ID: process.env.FEISHU_APP_ID || 'cli_a74001f855b0d00c',
  APP_SECRET: process.env.FEISHU_APP_SECRET || 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq',
  BASE_URL: 'https://open.feishu.cn/open-apis'
};

// 全局访问令牌缓存
let accessToken = null;
let tokenExpiry = null;

// 获取访问令牌
async function getAccessToken() {
  try {
    // 如果token还有效，直接返回
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
      return accessToken;
    }

    const response = await axios.post(`${FEISHU_CONFIG.BASE_URL}/auth/v3/tenant_access_token/internal`, {
      app_id: FEISHU_CONFIG.APP_ID,
      app_secret: FEISHU_CONFIG.APP_SECRET
    });

    if (response.data.code === 0) {
      accessToken = response.data.tenant_access_token;
      // 设置过期时间（提前5分钟刷新）
      tokenExpiry = Date.now() + (response.data.expire - 300) * 1000;
      return accessToken;
    } else {
      throw new Error(`获取访问令牌失败: ${response.data.msg}`);
    }
  } catch (error) {
    console.error('获取访问令牌失败:', error.message);
    throw error;
  }
}

exports.handler = async (event, context) => {
  // 设置CORS头
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // 处理OPTIONS预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { path, httpMethod, queryStringParameters, body } = event;
    
    // 解析API路径
    const apiPath = path.replace('/.netlify/functions/feishu-api', '');
    
    // 获取访问令牌
    const token = await getAccessToken();
    
    // 构建请求配置
    const requestConfig = {
      method: httpMethod,
      url: `${FEISHU_CONFIG.BASE_URL}${apiPath}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: queryStringParameters
    };

    // 如果有请求体，添加到配置中
    if (body && (httpMethod === 'POST' || httpMethod === 'PUT')) {
      requestConfig.data = JSON.parse(body);
    }

    // 发送请求到飞书API
    const response = await axios(requestConfig);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    console.error('飞书API调用失败:', error.message);
    
    return {
      statusCode: error.response?.status || 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        details: error.response?.data || null
      })
    };
  }
}; 