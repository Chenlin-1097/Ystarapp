const axios = require('axios');

// 配置信息
const CONFIG = {
  FEISHU: {
    APP_ID: 'cli_a74001f855b0d00c',
    APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq',
    BASE_URL: 'https://open.feishu.cn/open-apis'
  }
};

// 要检查的知识库文档URL
const WIKI_DOCUMENT_URL = 'https://rfwfcs43e0.feishu.cn/wiki/O20dw9tvficXm0kffTWc9qojnOf';

// 获取访问令牌
async function getAccessToken() {
  try {
    const response = await axios.post(
      `${CONFIG.FEISHU.BASE_URL}/auth/v3/tenant_access_token/internal`,
      {
        app_id: CONFIG.FEISHU.APP_ID,
        app_secret: CONFIG.FEISHU.APP_SECRET
      }
    );

    if (response.data.code === 0) {
      return response.data.tenant_access_token;
    } else {
      throw new Error('获取访问令牌失败: ' + response.data.msg);
    }
  } catch (error) {
    console.error('获取访问令牌失败:', error);
    throw error;
  }
}

// 从URL中提取文档信息
function extractDocumentInfo(documentUrl) {
  try {
    // 支持多种URL格式
    const patterns = [
      // 标准知识库URL: https://xxx.feishu.cn/wiki/nodeToken
      /\/wiki\/([a-zA-Z0-9]+)(?:\?|$)/,
      // 带space的URL: https://xxx.feishu.cn/wiki/space/spaceId/nodeToken
      /\/wiki\/space\/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)/,
      // 其他可能的格式
      /\/wiki\/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)/
    ];

    for (const pattern of patterns) {
      const match = documentUrl.match(pattern);
      if (match) {
        if (match.length === 2) {
          // 只有nodeToken
          return { nodeToken: match[1], spaceId: null };
        } else if (match.length === 3) {
          // 有spaceId和nodeToken
          return { spaceId: match[1], nodeToken: match[2] };
        }
      }
    }

    throw new Error('无法从URL中提取文档信息');
  } catch (error) {
    console.error('提取文档信息失败:', error);
    throw error;
  }
}

// 检查知识库文档访问权限（优化版本）
async function checkWikiDocumentAccess(accessToken, documentUrl) {
  try {
    console.log('\n🔍 开始检查知识库文档访问权限...');
    console.log('文档URL:', documentUrl);
    
    // 提取文档信息
    const docInfo = extractDocumentInfo(documentUrl);
    console.log('提取的文档信息:', docInfo);

    // 创建axios实例
    const api = axios.create({
      baseURL: CONFIG.FEISHU.BASE_URL,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // 尝试多种API端点访问文档
    const apiAttempts = [
      // 方法1: 直接通过node_token获取节点信息（推荐）
      {
        method: 'getNodeInfo',
        description: '通过节点令牌获取信息',
        endpoint: `/wiki/v2/nodes/${docInfo.nodeToken}`,
        execute: () => api.get(`/wiki/v2/nodes/${docInfo.nodeToken}`)
      },
      // 方法2: 如果有space_id，通过space和node获取
      ...(docInfo.spaceId ? [{
        method: 'getWikiDocument',
        description: '通过空间和节点获取文档',
        endpoint: `/wiki/v2/spaces/${docInfo.spaceId}/nodes/${docInfo.nodeToken}`,
        execute: () => api.get(`/wiki/v2/spaces/${docInfo.spaceId}/nodes/${docInfo.nodeToken}`)
      }] : []),
      // 方法3: 尝试云文档API
      {
        method: 'getDocxDocument',
        description: '尝试云文档API',
        endpoint: `/docx/v1/documents/${docInfo.nodeToken}`,
        execute: () => api.get(`/docx/v1/documents/${docInfo.nodeToken}`)
      },
      // 方法4: 尝试云盘文件API
      {
        method: 'getDriveFile',
        description: '尝试云盘文件API',
        endpoint: `/drive/v1/files/${docInfo.nodeToken}`,
        execute: () => api.get(`/drive/v1/files/${docInfo.nodeToken}`)
      }
    ];

    // 依次尝试各种方法
    for (const attempt of apiAttempts) {
      try {
        console.log(`\n📋 尝试方法: ${attempt.description}`);
        console.log(`   API端点: ${attempt.endpoint}`);
        
        const response = await attempt.execute();
        
        if (response.data.code === 0) {
          console.log(`✅ 成功访问文档 - 方法: ${attempt.method}`);
          console.log('文档信息:', JSON.stringify(response.data.data, null, 2));
          return {
            hasAccess: true,
            method: attempt.method,
            endpoint: attempt.endpoint,
            data: response.data.data,
            nodeToken: docInfo.nodeToken,
            spaceId: docInfo.spaceId
          };
        } else {
          console.log(`❌ 访问失败 - 错误码: ${response.data.code}, 消息: ${response.data.msg}`);
        }
      } catch (error) {
        if (error.response) {
          console.log(`❌ API请求失败 - 状态码: ${error.response.status}`);
          console.log(`   错误信息: ${JSON.stringify(error.response.data, null, 2)}`);
          
          // 检查是否是权限问题
          if (error.response.data.code === 99991672) {
            console.log('   🔒 权限不足 - 需要申请相应的知识库访问权限');
          } else if (error.response.data.code === 230002) {
            console.log('   🔒 文档不存在或无权限访问');
          } else if (error.response.data.code === 1254005) {
            console.log('   🔒 应用未获得访问该文档的权限');
          }
        } else {
          console.log(`❌ 网络错误: ${error.message}`);
        }
      }
    }

    console.log('❌ 所有访问方法都失败');
    return {
      hasAccess: false,
      error: '所有API端点都无法访问该文档，可能需要申请相应权限',
      nodeToken: docInfo.nodeToken,
      spaceId: docInfo.spaceId
    };
    
  } catch (error) {
    console.error('检查文档访问权限时发生错误:', error);
    return {
      hasAccess: false,
      error: error.message,
      nodeToken: null,
      spaceId: null
    };
  }
}

// 检查当前应用已有的权限
async function checkCurrentPermissions(accessToken) {
  try {
    console.log('\n📊 检查当前应用权限...');
    
    const api = axios.create({
      baseURL: CONFIG.FEISHU.BASE_URL,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const permissions = {
      bitable: false,
      wiki: false,
      docx: false,
      drive: false
    };

    // 测试多维表格权限
    console.log('\n1. 测试多维表格权限...');
    try {
      const bitableResponse = await api.get('/bitable/v1/apps', {
        params: { page_size: 1 }
      });
      
      if (bitableResponse.data.code === 0) {
        permissions.bitable = true;
        console.log('✅ 多维表格权限正常');
        console.log(`   可访问的多维表格数量: ${bitableResponse.data.data.items.length}`);
      } else {
        console.log('❌ 多维表格权限异常:', bitableResponse.data.msg);
      }
    } catch (error) {
      console.log('❌ 多维表格权限测试失败:', error.response?.data?.msg || error.message);
    }
    
    // 测试知识库权限
    console.log('\n2. 测试知识库权限...');
    try {
      const wikiResponse = await api.get('/wiki/v2/spaces', {
        params: { page_size: 1 }
      });
      
      if (wikiResponse.data.code === 0) {
        permissions.wiki = true;
        console.log('✅ 知识库权限正常');
        console.log(`   可访问的知识库数量: ${wikiResponse.data.data.items.length}`);
        
        // 如果有知识库，显示第一个知识库的信息
        if (wikiResponse.data.data.items.length > 0) {
          const firstSpace = wikiResponse.data.data.items[0];
          console.log(`   第一个知识库: ${firstSpace.name} (ID: ${firstSpace.space_id})`);
        }
      } else {
        console.log('❌ 知识库权限异常:', wikiResponse.data.msg);
      }
    } catch (error) {
      if (error.response && error.response.data.code === 99991672) {
        console.log('❌ 知识库权限不足 - 需要申请wiki相关权限');
      } else {
        console.log('❌ 知识库权限测试失败:', error.response?.data?.msg || error.message);
      }
    }
    
    // 测试云文档权限
    console.log('\n3. 测试云文档权限...');
    try {
      const docsResponse = await api.get('/docx/v1/documents', {
        params: { page_size: 1 }
      });
      
      if (docsResponse.data.code === 0) {
        permissions.docx = true;
        console.log('✅ 云文档权限正常');
      } else {
        console.log('❌ 云文档权限异常:', docsResponse.data.msg);
      }
    } catch (error) {
      if (error.response && error.response.data.code === 99991672) {
        console.log('❌ 云文档权限不足 - 需要申请docx相关权限');
      } else {
        console.log('❌ 云文档权限测试失败:', error.response?.data?.msg || error.message);
      }
    }

    // 测试云盘权限
    console.log('\n4. 测试云盘权限...');
    try {
      const driveResponse = await api.get('/drive/v1/files', {
        params: { page_size: 1 }
      });
      
      if (driveResponse.data.code === 0) {
        permissions.drive = true;
        console.log('✅ 云盘权限正常');
      } else {
        console.log('❌ 云盘权限异常:', driveResponse.data.msg);
      }
    } catch (error) {
      if (error.response && error.response.data.code === 99991672) {
        console.log('❌ 云盘权限不足 - 需要申请drive相关权限');
      } else {
        console.log('❌ 云盘权限测试失败:', error.response?.data?.msg || error.message);
      }
    }

    return permissions;
    
  } catch (error) {
    console.error('检查权限时发生错误:', error);
    return null;
  }
}

// 生成权限申请建议
function generatePermissionSuggestions(permissions, accessResult) {
  console.log('\n💡 权限申请建议:');
  console.log('==================');

  const suggestions = [];

  if (!permissions.wiki) {
    suggestions.push({
      permission: 'wiki:wiki',
      description: '知识库完整权限（推荐）',
      reason: '可以读取和编辑知识库文档'
    });
    suggestions.push({
      permission: 'wiki:wiki:readonly',
      description: '知识库只读权限',
      reason: '只能读取知识库文档'
    });
  }

  if (!permissions.docx) {
    suggestions.push({
      permission: 'docx:document',
      description: '云文档完整权限',
      reason: '可以读取和编辑云文档'
    });
    suggestions.push({
      permission: 'docx:document:readonly',
      description: '云文档只读权限',
      reason: '只能读取云文档'
    });
  }

  if (!permissions.drive) {
    suggestions.push({
      permission: 'drive:file',
      description: '云盘文件权限',
      reason: '可以访问云盘中的文件'
    });
  }

  if (suggestions.length === 0) {
    console.log('✅ 当前权限配置良好，但仍无法访问目标文档');
    console.log('   可能原因：');
    console.log('   1. 文档不存在或已被删除');
    console.log('   2. 文档所在的知识库未对应用开放');
    console.log('   3. 需要文档所有者单独授权');
  } else {
    console.log('建议申请以下权限之一：');
    suggestions.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion.permission}`);
      console.log(`   描述: ${suggestion.description}`);
      console.log(`   作用: ${suggestion.reason}`);
    });
  }
}

// 主函数
async function main() {
  try {
    console.log('🚀 飞书知识库文档权限检查工具 v2.0');
    console.log('========================================\n');
    
    // 1. 获取访问令牌
    console.log('1. 获取访问令牌...');
    const accessToken = await getAccessToken();
    console.log('✅ 访问令牌获取成功');
    
    // 2. 检查当前权限
    const permissions = await checkCurrentPermissions(accessToken);
    
    // 3. 检查特定文档访问权限
    const result = await checkWikiDocumentAccess(accessToken, WIKI_DOCUMENT_URL);
    
    // 4. 输出结果
    console.log('\n📋 检查结果总结');
    console.log('==================');
    
    if (result.hasAccess) {
      console.log('✅ 可以访问该知识库文档');
      console.log('使用的方法:', result.method);
      console.log('API端点:', result.endpoint);
      console.log('文档节点令牌:', result.nodeToken);
      if (result.spaceId) {
        console.log('知识库空间ID:', result.spaceId);
      }
    } else {
      console.log('❌ 无法访问该知识库文档');
      console.log('错误原因:', result.error);
      
      // 生成权限申请建议
      if (permissions) {
        generatePermissionSuggestions(permissions, result);
      }
    }
    
    console.log('\n🔗 相关链接:');
    console.log('- 权限配置: https://open.feishu.cn/app/cli_a74001f855b0d00c/auth');
    console.log('- 飞书API文档: https://open.feishu.cn/document/');
    console.log('- Wiki API文档: https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/wiki-overview');
    console.log('- 目标文档: ' + WIKI_DOCUMENT_URL);
    
    console.log('\n📞 下一步操作:');
    if (!result.hasAccess) {
      console.log('1. 访问权限配置页面申请相应权限');
      console.log('2. 等待企业管理员审核通过');
      console.log('3. 重新运行此脚本验证权限');
    } else {
      console.log('1. 权限配置正常，可以在系统中集成知识库功能');
      console.log('2. 使用WikiService.checkDocumentAccess()方法访问文档');
    }
    
  } catch (error) {
    console.error('\n❌ 检查过程中发生错误:', error.message);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = {
  getAccessToken,
  extractDocumentInfo,
  checkWikiDocumentAccess,
  checkCurrentPermissions,
  generatePermissionSuggestions
}; 