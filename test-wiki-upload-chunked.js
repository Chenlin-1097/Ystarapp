const fs = require('fs');
const lark = require('@larksuiteoapi/node-sdk');
const FormData = require('form-data');
const { Readable } = require('stream');
const axios = require('axios');
const adler32 = require('adler-32');

// 飞书配置
const FEISHU_CONFIG = {
  APP_ID: 'cli_a74001f855b0d00c',
  APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq'
};

// 测试配置
const TEST_CONFIG = {
  FILE_PATH: 'WSD2715线上款式明细.xlsx',
  PARENT_NODE: 'ShX6fAZyrlWEQvdaB5PcDsbcn6f'
};

class FileUploader {
  constructor() {
    // 创建飞书客户端
    this.client = new lark.Client({
      appId: FEISHU_CONFIG.APP_ID,
      appSecret: FEISHU_CONFIG.APP_SECRET,
      disableTokenCache: false // 使用SDK的token管理
    });

    // 创建axios实例
    this.axios = axios.create({
      baseURL: 'https://open.feishu.cn',
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 30000 // 30秒超时
    });
  }

  // 计算Adler-32校验和
  calculateAdler32(chunk) {
    return adler32.buf(chunk) >>> 0; // 转换为无符号32位整数
  }

  // 获取token
  async getToken() {
    const tokenResponse = await this.client.request({
      method: 'POST',
      url: '/open-apis/auth/v3/tenant_access_token/internal',
      data: {
        app_id: FEISHU_CONFIG.APP_ID,
        app_secret: FEISHU_CONFIG.APP_SECRET
      }
    });
    return tokenResponse.tenant_access_token;
  }

  // 预上传
  async uploadPrepare(filePath) {
    try {
      console.log('🚀 开始预上传...');
      const stats = fs.statSync(filePath);
      const fileName = filePath.split('\\').pop();

      const response = await this.client.drive.v1.file.uploadPrepare({
        data: {
          file_name: fileName,
          parent_type: 'explorer',
          parent_node: TEST_CONFIG.PARENT_NODE,
          size: stats.size
        }
      });

      console.log('✅ 预上传成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 预上传失败:', error.message);
      throw error;
    }
  }

  // 上传单个分片
  async uploadChunk(chunk, seq, uploadInfo, token, totalChunks) {
    const checksum = this.calculateAdler32(chunk).toString();
    const retryLimit = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= retryLimit; attempt++) {
      try {
        console.log(`📤 上传分片 ${seq + 1}/${totalChunks} (尝试 ${attempt}/${retryLimit})`, {
          seq,
          size: chunk.length,
          checksum
        });
        
        // 创建FormData
        const form = new FormData();
        form.append('upload_id', uploadInfo.upload_id);
        form.append('seq', seq);
        form.append('size', chunk.length);
        form.append('checksum', checksum);
        form.append('file', chunk, {
          filename: 'chunk',
          contentType: 'application/octet-stream'
        });

        // 上传分片
        const response = await this.axios.post('/open-apis/drive/v1/files/upload_part', form, {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.data.code !== 0) {
          throw new Error(`API错误: ${response.data.msg} (${JSON.stringify(response.data.error)})`);
        }

        console.log(`✅ 分片 ${seq + 1}/${totalChunks} 上传成功`);
        return;
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ 分片 ${seq + 1}/${totalChunks} 上传失败 (尝试 ${attempt}/${retryLimit}):`, error.message);
        
        if (attempt < retryLimit) {
          // 指数退避重试
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`分片 ${seq + 1}/${totalChunks} 上传失败，已重试${retryLimit}次: ${lastError.message}`);
  }

  // 分片上传
  async uploadChunks(filePath, uploadInfo) {
    try {
      console.log('📤 开始分片上传...');
      const fileBuffer = fs.readFileSync(filePath);
      const chunkSize = 4 * 1024 * 1024; // 4MB chunks
      const totalChunks = uploadInfo.block_num;
      const token = await this.getToken(); // 预先获取token
      const startTime = Date.now();

      // 创建所有分片的上传任务
      const chunks = Array.from({ length: totalChunks }, (_, i) => {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileBuffer.length);
        return {
          chunk: fileBuffer.slice(start, end),
          seq: i
        };
      });

      // 并发上传所有分片，但限制最大并发数为3
      const batchSize = 3;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        await Promise.all(
          batch.map(({ chunk, seq }) => 
            this.uploadChunk(chunk, seq, uploadInfo, token, totalChunks)
          )
        );
        
        // 每批次之间稍微延迟一下，避免服务器压力过大
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      const speed = (fileBuffer.length / (1024 * 1024)) / duration; // MB/s

      console.log(`✅ 所有分片上传完成，耗时：${duration.toFixed(1)}秒，平均速度：${speed.toFixed(2)}MB/s`);
    } catch (error) {
      console.error('❌ 分片上传失败:', error.message);
      throw error;
    }
  }

  // 完成上传
  async uploadFinish(uploadInfo) {
    try {
      console.log('🎯 完成上传...');
      const response = await this.client.drive.v1.file.uploadFinish({
        data: {
          upload_id: uploadInfo.upload_id,
          block_num: uploadInfo.block_num
        }
      });

      console.log('✅ 上传完成:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 完成上传失败:', error.message);
      throw error;
    }
  }

  // 执行完整的上传流程
  async upload(filePath) {
    try {
      console.log('🚀 开始上传文件:', filePath);
      
      // 1. 预上传
      const uploadInfo = await this.uploadPrepare(filePath);
      
      // 2. 分片上传
      await this.uploadChunks(filePath, uploadInfo);
      
      // 3. 完成上传
      const result = await this.uploadFinish(uploadInfo);
      
      console.log('✅ 文件上传成功！');
      return result;
    } catch (error) {
      console.error('❌ 文件上传失败:', error.message);
      throw error;
    }
  }
}

// 执行上传
async function main() {
  const uploader = new FileUploader();
  await uploader.upload(TEST_CONFIG.FILE_PATH);
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { FileUploader }; 