const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FormData = require('form-data');

// 飞书配置
const FEISHU_CONFIG = {
  APP_ID: 'cli_a74001f855b0d00c',
  APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq',
  BASE_URL: 'https://open.feishu.cn/open-apis'
};

// 测试配置 - 基于您提供的知识库地址
const TEST_CONFIG = {
  // 从URL https://rfwfcs43e0.feishu.cn/wiki/O20dw9tvficXm0kffTWc9qojnOf?table=blkeZ3X25Gj8OA4c 提取
  SPACE_ID: 'O20dw9tvficXm0kffTWc9qojnOf', // 知识库空间ID
  
  // 这个需要您提供具体的node_token，因为URL中的是table参数，不是node_token
  // 您可以在知识库页面右击某个节点获取其node_token
  PARENT_WIKI_TOKEN: 'O20dw9tvficXm0kffTWc9qojnOf', // 暂时使用space_id，可能需要调整
  
  // 测试文件
  TEST_FILE_PATH: './WSD2715线上款式明细.xlsx',
  
  // 云空间父节点（可选）
  PARENT_NODE: null
};

// 简化的飞书服务类
class SimpleFeishuUploader {
  constructor() {
    this.accessToken = null;
  }

  // 获取访问令牌
  async getAccessToken() {
    try {
      console.log('🔑 获取访问令牌...');
      const response = await axios.post(`${FEISHU_CONFIG.BASE_URL}/auth/v3/tenant_access_token/internal`, {
        app_id: FEISHU_CONFIG.APP_ID,
        app_secret: FEISHU_CONFIG.APP_SECRET
      });

      if (response.data.code === 0) {
        this.accessToken = response.data.tenant_access_token;
        console.log('✅ 访问令牌获取成功');
        return this.accessToken;
      } else {
        throw new Error(`获取访问令牌失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('❌ 获取访问令牌失败:', error.message);
      throw error;
    }
  }

  // 计算文件MD5
  calculateMD5(filePath) {
    const crypto = require('crypto');
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  // 方式1：普通文件上传
  async uploadFileNormal(filePath, fileName) {
    try {
      console.log('📤 方式1：普通文件上传...');
      
      const token = await this.getAccessToken();
      const fileStats = fs.statSync(filePath);
      const checksum = this.calculateMD5(filePath);
      
      console.log('📋 上传参数:', {
        file_name: fileName,
        parent_type: 'explorer',
        size: fileStats.size,
        checksum: checksum
      });
      
      const formData = new FormData();
      formData.append('file_name', fileName);
      formData.append('parent_type', 'explorer');
      formData.append('size', fileStats.size.toString());
      formData.append('checksum', checksum);
      formData.append('file', fs.createReadStream(filePath));

      const response = await axios.post(`${FEISHU_CONFIG.BASE_URL}/drive/v1/files/upload_all`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...formData.getHeaders()
        },
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      console.log('📤 普通上传响应:', JSON.stringify(response.data, null, 2));

      if (response.data.code === 0) {
        const fileToken = response.data.data.file_token;
        console.log('✅ 普通上传成功，file_token:', fileToken);
        return fileToken;
      } else {
        throw new Error(`普通上传失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.log('❌ 普通上传失败:', {
        status: error.response?.status,
        code: error.response?.data?.code,
        message: error.response?.data?.msg || error.message
      });
      return null;
    }
  }

  // 方式2：预上传方式
  async uploadFilePrepare(filePath, fileName) {
    try {
      console.log('📤 方式2：预上传方式...');
      
      const token = await this.getAccessToken();
      const fileStats = fs.statSync(filePath);
      
      console.log('📋 预上传参数:', {
        file_name: fileName,
        parent_type: 'explorer',
        size: fileStats.size
      });

      const prepareResponse = await axios.post(`${FEISHU_CONFIG.BASE_URL}/drive/v1/files/upload_prepare`, {
        file_name: fileName,
        parent_type: 'explorer',
        size: fileStats.size
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📋 预上传响应:', JSON.stringify(prepareResponse.data, null, 2));
      
      if (prepareResponse.data.code === 0) {
        console.log('✅ 预上传准备成功');
        return prepareResponse.data.data;
      } else {
        throw new Error(`预上传失败: ${prepareResponse.data.msg}`);
      }
    } catch (error) {
      console.log('❌ 预上传失败:', {
        status: error.response?.status,
        code: error.response?.data?.code,
        message: error.response?.data?.msg || error.message
      });
      return null;
    }
  }

  // 方式3：素材上传方式
  async uploadFileMedia(filePath, fileName) {
    try {
      console.log('📤 方式3：素材上传方式...');
      
      const token = await this.getAccessToken();
      const fileStats = fs.statSync(filePath);
      const fileExtension = fileName.split('.').pop().toLowerCase();
      
      const formData = new FormData();
      formData.append('file_name', fileName);
      formData.append('parent_type', 'ccm_import_open');
      formData.append('size', fileStats.size.toString());
      
      // 添加extra参数
      const extraParam = JSON.stringify({
        obj_type: 'sheet',
        file_extension: fileExtension
      });
      formData.append('extra', extraParam);
      formData.append('file', fs.createReadStream(filePath));

      console.log('📋 素材上传参数:', {
        file_name: fileName,
        parent_type: 'ccm_import_open',
        size: fileStats.size,
        extra: extraParam
      });

      const response = await axios.post(`${FEISHU_CONFIG.BASE_URL}/drive/v1/medias/upload_all`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...formData.getHeaders()
        },
        timeout: 120000
      });

      console.log('📤 素材上传响应:', JSON.stringify(response.data, null, 2));

      if (response.data.code === 0) {
        const fileToken = response.data.data.file_token;
        console.log('✅ 素材上传成功，file_token:', fileToken);
        return fileToken;
      } else {
        throw new Error(`素材上传失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.log('❌ 素材上传失败:', {
        status: error.response?.status,
        code: error.response?.data?.code,
        message: error.response?.data?.msg || error.message
      });
      return null;
    }
  }

  // 上传文件到云空间（尝试多种方式）
  async uploadFile(filePath, fileName) {
    console.log('📤 开始尝试多种上传方式...\n');

    // 尝试方式1：普通上传
    let fileToken = await this.uploadFileNormal(filePath, fileName);
    if (fileToken) return fileToken;

    console.log('\n🔄 普通上传失败，尝试其他方式...\n');

    // 尝试方式2：预上传
    const prepareResult = await this.uploadFilePrepare(filePath, fileName);
    if (prepareResult) {
      console.log('📋 预上传成功，但需要进一步实现分片上传逻辑');
    }

    console.log('\n🔄 尝试方式3...\n');

    // 尝试方式3：素材上传
    fileToken = await this.uploadFileMedia(filePath, fileName);
    if (fileToken) return fileToken;

    throw new Error('所有上传方式都失败了');
  }

  // 将文件移动到知识库
  async moveToWiki(spaceId, parentWikiToken, fileToken) {
    try {
      console.log('📚 将文件移动到知识库...');
      
      const token = await this.getAccessToken();
      
      const moveParams = {
        parent_wiki_token: parentWikiToken,
        obj_type: 'file',
        obj_token: fileToken
      };

      console.log('移动参数:', JSON.stringify(moveParams, null, 2));

      const response = await axios.post(`${FEISHU_CONFIG.BASE_URL}/wiki/v2/spaces/${spaceId}/nodes/move_docs_to_wiki`, moveParams, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log('📚 知识库移动响应:', JSON.stringify(response.data, null, 2));

      if (response.data.code === 0) {
        console.log('✅ 文件已成功移动到知识库');
        return response.data.data;
      } else {
        throw new Error(`移动到知识库失败: ${response.data.msg} (code: ${response.data.code})`);
      }
    } catch (error) {
      console.error('❌ 移动到知识库失败:', error.message);
      if (error.response) {
        console.error('HTTP错误详情:', {
          status: error.response.status,
          data: JSON.stringify(error.response.data, null, 2)
        });
      }
      throw error;
    }
  }
}



async function testSpecificWikiUpload() {
  console.log('🧪 开始测试将WSD2715线上款式明细.xlsx上传到指定知识库...\n');
  console.log('目标知识库:', 'https://rfwfcs43e0.feishu.cn/wiki/O20dw9tvficXm0kffTWc9qojnOf');
  console.log('='.repeat(80));

  const uploader = new SimpleFeishuUploader();

  try {
    // 1. 检查测试文件
    console.log('📄 步骤1: 检查测试文件...');
    if (!fs.existsSync(TEST_CONFIG.TEST_FILE_PATH)) {
      throw new Error(`测试文件不存在: ${TEST_CONFIG.TEST_FILE_PATH}`);
    }

    const fileStats = fs.statSync(TEST_CONFIG.TEST_FILE_PATH);
    const fileName = path.basename(TEST_CONFIG.TEST_FILE_PATH);
    
    console.log('文件信息:', {
      路径: TEST_CONFIG.TEST_FILE_PATH,
      名称: fileName,
      大小: `${(fileStats.size / 1024 / 1024).toFixed(2)} MB`,
      修改时间: fileStats.mtime.toISOString()
    });
    console.log('✅ 测试文件检查完成\n');

    // 2. 测试上传到云空间
    console.log('☁️ 步骤2: 上传文件到云空间...');
    console.log('上传参数:', {
      fileName: fileName,
      fileSize: fileStats.size,
      filePath: TEST_CONFIG.TEST_FILE_PATH
    });

    const fileToken = await uploader.uploadFile(
      TEST_CONFIG.TEST_FILE_PATH, 
      fileName
    );
    
    console.log('✅ 文件上传到云空间成功!');
    console.log('📄 获得file_token:', fileToken);
    console.log('');

    // 3. 测试移动到知识库
    console.log('📚 步骤3: 将文件移动到知识库...');
    console.log('知识库参数:', {
      spaceId: TEST_CONFIG.SPACE_ID,
      parentWikiToken: TEST_CONFIG.PARENT_WIKI_TOKEN,
      objToken: fileToken,
      objType: 'file'
    });

    const moveResult = await uploader.moveToWiki(
      TEST_CONFIG.SPACE_ID,
      TEST_CONFIG.PARENT_WIKI_TOKEN,
      fileToken
    );

    console.log('✅ 文件移动到知识库成功!');
    console.log('📋 移动结果:', JSON.stringify(moveResult, null, 2));
    console.log('');

    // 测试总结
    console.log('🎉 测试完成! 结果总结:');
    console.log('='.repeat(80));
    console.log('✅ 文件检查: 通过');
    console.log('✅ 云空间上传: 成功');
    console.log('✅ 知识库移动: 成功'); 
    console.log('');
    console.log('📍 您可以在以下地址查看上传的文档:');
    console.log('🔗 https://rfwfcs43e0.feishu.cn/wiki/O20dw9tvficXm0kffTWc9qojnOf');
    console.log('');
    console.log('📋 上传的文档:');
    console.log(`1. ${fileName} (file_token: ${fileToken})`);

  } catch (error) {
    console.error('❌ 测试失败!');
    console.error('错误信息:', error.message);
    console.error('');
    
    if (error.response) {
      console.error('HTTP错误详情:');
      console.error('状态码:', error.response.status);
      console.error('状态文本:', error.response.statusText);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
    
    console.error('完整错误:', error);
    
    // 根据错误类型提供建议
    if (error.message.includes('401') || error.message.includes('权限')) {
      console.log('\n💡 可能的解决方案:');
      console.log('1. 检查应用是否有知识库的管理权限');
      console.log('2. 确认知识库space_id是否正确');
      console.log('3. 检查node_token是否有效');
    } else if (error.message.includes('404')) {
      console.log('\n💡 可能的解决方案:');
      console.log('1. 检查知识库space_id是否存在');
      console.log('2. 确认node_token是否正确');
      console.log('3. 检查API地址是否正确');
    } else if (error.message.includes('网络') || error.message.includes('连接')) {
      console.log('\n💡 可能的解决方案:');
      console.log('1. 检查网络连接');
      console.log('2. 检查飞书API配置');
      console.log('3. 确认防火墙设置');
    }
  }
}

// 辅助函数：获取正确的node_token
async function getWikiNodeInfo() {
  console.log('🔍 获取知识库节点信息...\n');
  
  try {
    // 这里可以添加获取知识库结构的代码
    console.log('ℹ️ 知识库URL解析:');
    console.log('原始URL: https://rfwfcs43e0.feishu.cn/wiki/O20dw9tvficXm0kffTWc9qojnOf?table=blkeZ3X25Gj8OA4c');
    console.log('Space ID: O20dw9tvficXm0kffTWc9qojnOf');
    console.log('Table参数: blkeZ3X25Gj8OA4c');
    console.log('');
    console.log('⚠️ 注意: URL中的table参数不是node_token');
    console.log('📝 建议: 在知识库页面右击节点获取正确的node_token');
    
  } catch (error) {
    console.error('获取节点信息失败:', error.message);
  }
}

// 运行测试
async function runTest() {
  console.log('🚀 知识库文档上传专项测试');
  console.log('目标: 上传 WSD2715线上款式明细.xlsx 到指定知识库');
  console.log('='.repeat(80));
  
  // 显示节点信息
  await getWikiNodeInfo();
  
  // 运行上传测试
  await testSpecificWikiUpload();
  
  console.log('='.repeat(80));
  console.log('🏁 测试结束');
}

// 如果直接运行此文件
if (require.main === module) {
  runTest().catch(console.error);
}

module.exports = {
  testSpecificWikiUpload,
  getWikiNodeInfo,
  runTest,
  TEST_CONFIG
}; 