// const multipart = require('lambda-multipart-parser');
const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');

// 飞书配置
const FEISHU_CONFIG = {
  APP_ID: process.env.FEISHU_APP_ID || 'cli_a74001f855b0d00c',
  APP_SECRET: process.env.FEISHU_APP_SECRET || 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq',
  BASE_URL: 'https://open.feishu.cn/open-apis'
};

// 访问令牌缓存
let accessToken = null;
let tokenExpiry = null;

// 获取访问令牌
async function getAccessToken() {
  try {
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
      return accessToken;
    }

    const response = await axios.post(`${FEISHU_CONFIG.BASE_URL}/auth/v3/tenant_access_token/internal`, {
      app_id: FEISHU_CONFIG.APP_ID,
      app_secret: FEISHU_CONFIG.APP_SECRET
    });

    if (response.data.code === 0) {
      accessToken = response.data.tenant_access_token;
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: '只支持POST方法' })
    };
  }

  try {
    console.log('📤 收到Excel文件上传请求');
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // 简化测试：先测试基本功能
    const token = await getAccessToken();
    console.log('✅ 获取访问令牌成功');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Netlify Function正常工作！',
        timestamp: new Date().toISOString(),
        hasToken: !!token,
        event: {
          httpMethod: event.httpMethod,
          path: event.path,
          bodySize: event.body ? event.body.length : 0
        }
      })
    };

  } catch (error) {
    console.error('❌ Excel文件处理失败:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
    };
  }
}; 