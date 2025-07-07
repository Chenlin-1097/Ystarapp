const multipart = require('lambda-multipart-parser');
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

// Adler32校验和计算（与前端一致）
function calculateAdler32(buffer) {
  let a = 1;
  let b = 0;
  const MOD_ADLER = 65521;

  for (let i = 0; i < buffer.length; i++) {
    a = (a + buffer[i]) % MOD_ADLER;
    b = (b + a) % MOD_ADLER;
  }

  return (b << 16) | a;
}

// 分片上传Excel文件（在Node.js环境中）
async function uploadExcelFileChunked(fileBuffer, fileName) {
  try {
    const token = await getAccessToken();
    const fileSize = fileBuffer.length;
    
    console.log(`📤 开始分片上传文件: ${fileName}, 大小: ${fileSize}`);

    // 1. 预上传
    const prepareResponse = await axios.post(
      `${FEISHU_CONFIG.BASE_URL}/drive/v1/files/upload_prepare`,
      {
        file_name: fileName,
        parent_type: 'explorer',
        size: fileSize,
        parent_node: 'ShX6fAZyrlWEQvdaB5PcDsbcn6f'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (prepareResponse.data.code !== 0) {
      throw new Error(`预上传失败: ${prepareResponse.data.msg}`);
    }

    const { upload_id, block_size, block_num } = prepareResponse.data.data;
    console.log(`✅ 预上传成功: upload_id=${upload_id}, 分片数=${block_num}`);

    // 2. 分片上传
    for (let seq = 0; seq < block_num; seq++) {
      const start = seq * block_size;
      const end = Math.min(start + block_size, fileSize);
      const chunk = fileBuffer.slice(start, end);
      const chunkSize = chunk.length;
      const checksum = calculateAdler32(chunk);

      console.log(`📦 上传分片 ${seq + 1}/${block_num}: 大小=${chunkSize}, 校验和=${checksum}`);

      // 使用Node.js的FormData（不是浏览器的FormData）
      const formData = new FormData();
      formData.append('upload_id', upload_id);
      formData.append('seq', seq.toString());
      formData.append('size', chunkSize.toString());
      formData.append('checksum', checksum.toString());
      formData.append('file', chunk, {
        filename: 'chunk',
        contentType: 'application/octet-stream'
      });

      const uploadResponse = await axios.post(
        `${FEISHU_CONFIG.BASE_URL}/drive/v1/files/upload_part`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            ...formData.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      if (uploadResponse.data.code !== 0) {
        throw new Error(`分片${seq}上传失败: ${uploadResponse.data.msg}`);
      }

      console.log(`✅ 分片${seq + 1}上传成功`);
    }

    // 3. 完成上传
    const finishResponse = await axios.post(
      `${FEISHU_CONFIG.BASE_URL}/drive/v1/files/upload_finish`,
      {
        upload_id: upload_id,
        block_num: block_num
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (finishResponse.data.code !== 0) {
      throw new Error(`完成上传失败: ${finishResponse.data.msg}`);
    }

    const fileToken = finishResponse.data.data.file_token;
    console.log(`✅ 文件上传完成: file_token=${fileToken}`);

    // 4. 导入为在线表格
    console.log('🔄 开始导入为在线表格...');
    const importResponse = await axios.post(
      `${FEISHU_CONFIG.BASE_URL}/sheets/v2/import`,
      {
        file_token: fileToken,
        type: 'xlsx'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (importResponse.data.code !== 0) {
      throw new Error(`Excel导入失败: ${importResponse.data.msg}`);
    }

    const importResult = importResponse.data.data;
    console.log('✅ Excel导入成功:', importResult);

    return {
      success: true,
      token: importResult.spreadsheet_token,
      url: importResult.url,
      message: 'Excel文件已成功分片上传并导入为在线表格'
    };

  } catch (error) {
    console.error('❌ 分片上传失败:', error);
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
    
    // 解析multipart数据
    const result = await multipart.parse(event);
    
    if (!result.files || result.files.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '没有接收到文件' })
      };
    }

    const file = result.files[0];
    const { spaceId, parentWikiToken } = result;

    console.log('文件信息:', {
      filename: file.filename,
      contentType: file.contentType,
      size: file.content.length
    });

    // 使用Node.js环境的分片上传
    const importResult = await uploadExcelFileChunked(file.content, file.filename);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        type: 'excel_import',
        importResult: importResult,
        message: 'Excel文件已成功分片上传并导入'
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
        details: error.stack
      })
    };
  }
}; 