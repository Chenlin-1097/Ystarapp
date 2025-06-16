import axios from 'axios';
import { CONFIG } from '../config/config.js';

class WikiServiceClass {
  constructor() {
    this.appId = CONFIG.FEISHU.APP_ID;
    this.appSecret = CONFIG.FEISHU.APP_SECRET;
    this.accessToken = null;
    this.tokenExpireTime = null;
    
    this.baseURL = process.env.NODE_ENV === 'development' 
      ? '/api/feishu' 
      : CONFIG.FEISHU.BASE_URL;
    
    // 创建axios实例
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
    });

    // 请求拦截器
    this.api.interceptors.request.use(async (config) => {
      await this.ensureAccessToken();
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });
  }

  // 获取访问令牌
  async getAccessToken() {
    try {
      const url = process.env.NODE_ENV === 'development' 
        ? '/api/feishu/auth/v3/tenant_access_token/internal'
        : `${CONFIG.FEISHU.BASE_URL}/auth/v3/tenant_access_token/internal`;
        
      const response = await axios.post(url, {
        app_id: this.appId,
        app_secret: this.appSecret
      });

      if (response.data.code === 0) {
        this.accessToken = response.data.tenant_access_token;
        this.tokenExpireTime = Date.now() + (response.data.expire - 300) * 1000;
        return this.accessToken;
      } else {
        throw new Error('获取访问令牌失败: ' + response.data.msg);
      }
    } catch (error) {
      console.error('获取访问令牌失败:', error);
      throw error;
    }
  }

  // 确保访问令牌有效
  async ensureAccessToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpireTime) {
      await this.getAccessToken();
    }
  }

  // 获取知识库空间列表
  async getSpaceList(pageSize = 20, pageToken = null) {
    try {
      const params = { page_size: pageSize };
      if (pageToken) {
        params.page_token = pageToken;
      }
      
      const response = await this.api.get('/wiki/v2/spaces', { params });
      
      if (response.data.code === 0) {
        return response.data.data;
      } else {
        throw new Error('获取知识库空间列表失败: ' + response.data.msg);
      }
    } catch (error) {
      console.error('获取知识库空间列表失败:', error);
      throw error;
    }
  }

  // 获取知识库空间信息
  async getSpaceInfo(spaceId) {
    try {
      const response = await this.api.get(`/wiki/v2/spaces/${spaceId}`);
      
      if (response.data.code === 0) {
        return response.data.data.space;
      } else {
        throw new Error('获取知识库空间信息失败: ' + response.data.msg);
      }
    } catch (error) {
      console.error('获取知识库空间信息失败:', error);
      throw error;
    }
  }

  // 获取知识库节点信息（推荐使用，不需要space_id）
  async getNodeInfo(nodeToken) {
    try {
      const response = await this.api.get(`/wiki/v2/nodes/${nodeToken}`);
      
      if (response.data.code === 0) {
        return response.data.data.node;
      } else {
        throw new Error('获取知识库节点信息失败: ' + response.data.msg);
      }
    } catch (error) {
      console.error('获取知识库节点信息失败:', error);
      throw error;
    }
  }

  // 获取知识库文档内容（需要space_id和node_token）
  async getWikiDocument(spaceId, nodeToken) {
    try {
      const response = await this.api.get(`/wiki/v2/spaces/${spaceId}/nodes/${nodeToken}`);
      
      if (response.data.code === 0) {
        return response.data.data.node;
      } else {
        throw new Error('获取知识库文档失败: ' + response.data.msg);
      }
    } catch (error) {
      console.error('获取知识库文档失败:', error);
      throw error;
    }
  }

  // 从URL中提取node_token和space_id
  extractDocumentInfo(documentUrl) {
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

  // 检查对特定知识库文档的访问权限（优化版本）
  async checkDocumentAccess(documentUrl) {
    try {
      console.log('检查知识库文档访问权限:', documentUrl);
      
      // 提取文档信息
      const docInfo = this.extractDocumentInfo(documentUrl);
      console.log('提取的文档信息:', docInfo);

      // 尝试多种API端点访问文档
      const apiAttempts = [
        // 方法1: 直接通过node_token获取节点信息（推荐）
        {
          method: 'getNodeInfo',
          description: '通过节点令牌获取信息',
          execute: () => this.getNodeInfo(docInfo.nodeToken)
        },
        // 方法2: 如果有space_id，通过space和node获取
        ...(docInfo.spaceId ? [{
          method: 'getWikiDocument',
          description: '通过空间和节点获取文档',
          execute: () => this.getWikiDocument(docInfo.spaceId, docInfo.nodeToken)
        }] : []),
        // 方法3: 尝试云文档API
        {
          method: 'getDocxDocument',
          description: '尝试云文档API',
          execute: async () => {
            const response = await this.api.get(`/docx/v1/documents/${docInfo.nodeToken}`);
            if (response.data.code === 0) {
              return response.data.data.document;
            } else {
              throw new Error('云文档API访问失败: ' + response.data.msg);
            }
          }
        }
      ];

      // 依次尝试各种方法
      for (const attempt of apiAttempts) {
        try {
          console.log(`📋 尝试方法: ${attempt.description}`);
          const result = await attempt.execute();
          
          console.log('✅ 知识库文档访问权限正常');
          return {
            hasAccess: true,
            document: result,
            nodeToken: docInfo.nodeToken,
            spaceId: docInfo.spaceId,
            method: attempt.method
          };
        } catch (error) {
          console.log(`❌ ${attempt.description}失败:`, error.message);
          
          // 检查是否是权限问题
          if (error.response && error.response.data.code === 99991672) {
            console.log('   🔒 权限不足 - 需要申请相应的知识库访问权限');
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
      console.error('检查知识库文档访问权限失败:', error);
      return {
        hasAccess: false,
        error: error.message,
        nodeToken: null,
        spaceId: null
      };
    }
  }

  // 更新知识库文档内容
  async updateWikiDocument(spaceId, nodeToken, content) {
    try {
      const response = await this.api.patch(`/wiki/v2/spaces/${spaceId}/nodes/${nodeToken}`, {
        content: content
      });

      if (response.data.code === 0) {
        return response.data.data.node;
      } else {
        throw new Error('更新知识库文档失败: ' + response.data.msg);
      }
    } catch (error) {
      console.error('更新知识库文档失败:', error);
      throw error;
    }
  }

  // 获取知识库节点的子节点列表
  async getChildNodes(spaceId, nodeToken, pageSize = 20, pageToken = null) {
    try {
      const params = { page_size: pageSize };
      if (pageToken) {
        params.page_token = pageToken;
      }
      
      const response = await this.api.get(`/wiki/v2/spaces/${spaceId}/nodes/${nodeToken}/children`, { params });
      
      if (response.data.code === 0) {
        return response.data.data;
      } else {
        throw new Error('获取子节点列表失败: ' + response.data.msg);
      }
    } catch (error) {
      console.error('获取子节点列表失败:', error);
      throw error;
    }
  }

  // 搜索知识库内容
  async searchWiki(query, spaceId = null, pageSize = 20, pageToken = null) {
    try {
      const params = { 
        query: query,
        page_size: pageSize 
      };
      
      if (spaceId) {
        params.space_id = spaceId;
      }
      
      if (pageToken) {
        params.page_token = pageToken;
      }
      
      const response = await this.api.post('/wiki/v2/nodes/search', params);
      
      if (response.data.code === 0) {
        return response.data.data;
      } else {
        throw new Error('搜索知识库失败: ' + response.data.msg);
      }
    } catch (error) {
      console.error('搜索知识库失败:', error);
      throw error;
    }
  }

  // 检查应用权限状态
  async checkPermissions() {
    try {
      const permissions = {
        wiki: false,
        docx: false,
        drive: false
      };

      // 检查知识库权限
      try {
        await this.getSpaceList(1);
        permissions.wiki = true;
        console.log('✅ 知识库权限正常');
      } catch (error) {
        console.log('❌ 知识库权限异常:', error.message);
      }

      // 检查云文档权限
      try {
        const response = await this.api.get('/docx/v1/documents');
        if (response.data.code === 0) {
          permissions.docx = true;
          console.log('✅ 云文档权限正常');
        }
      } catch (error) {
        console.log('❌ 云文档权限异常');
      }

      // 检查云盘权限
      try {
        const response = await this.api.get('/drive/v1/files');
        if (response.data.code === 0) {
          permissions.drive = true;
          console.log('✅ 云盘权限正常');
        }
      } catch (error) {
        console.log('❌ 云盘权限异常');
      }

      return permissions;
    } catch (error) {
      console.error('检查权限失败:', error);
      throw error;
    }
  }
}

export const WikiService = new WikiServiceClass(); 