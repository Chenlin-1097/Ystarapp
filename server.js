const express = require('express');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001; // 使用不同的端口避免与React冲突

// 配置信息
const CONFIG = {
  FEISHU: {
    APP_ID: 'cli_a74001f855b0d00c',
    APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq',
    BASE_URL: 'https://open.feishu.cn/open-apis'
  },
  TABLES: {
    USERS: {
      APP_TOKEN: 'RQj7bH20uaeNegsdERUclgcInAd',
      TABLE_ID: 'tblxbOsA83hEZShA',
      FIELDS: {
        INTERNAL_ID: '内部编号',
        USERNAME: '用户名',
        PASSWORD: '密码',
        NAME: '姓名',
        PERMISSIONS: '工序权限'
      }
    },
    PRODUCTS: {
      APP_TOKEN: 'RQj7bH20uaeNegsdERUclgcInAd',
      TABLE_ID: 'tblMpF28247NLFfX',
      FIELDS: {
        CREATE_DATE: '创建日期',
        CREATOR: '创建人',
        ORDER_NUMBER: '订单编号',
        WORK_TYPE_1: '工序1',
        OPERATOR: '操作人',
        WORK_TYPE_1_COMPLETE_TIME: '工序1完成时间',
        ATTACHMENT: '附件'
      }
    },
    WORK_HISTORY: {
      APP_TOKEN: 'RQj7bH20uaeNegsdERUclgcInAd',
      TABLE_ID: 'tbleX1cEZVzUvx2P',
      FIELDS: {
        TIMESTAMP: '报工时间',
        OPERATOR: '操作人',
        ORDER_NUMBER: '订单编号',
        WORK_TYPE: '工序类型',
        STATUS: '状态'
      }
    }
  }
};

// 中间件
app.use(cors());
app.use(express.json());

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

    const response = await axios.post(`${CONFIG.FEISHU.BASE_URL}/auth/v3/tenant_access_token/internal`, {
      app_id: CONFIG.FEISHU.APP_ID,
      app_secret: CONFIG.FEISHU.APP_SECRET
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

// JWT密钥
const JWT_SECRET = 'your-secret-key-here';

// 验证JWT中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: '缺少访问令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: '无效的访问令牌' });
    }
    req.user = user;
    next();
  });
}

// API路由

// 系统状态
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 用户登录
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: '用户名和密码不能为空' });
    }

    const token = await getAccessToken();
    
    const response = await axios.get(
      `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${CONFIG.TABLES.USERS.APP_TOKEN}/tables/${CONFIG.TABLES.USERS.TABLE_ID}/records`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          filter: `AND(CurrentValue.[${CONFIG.TABLES.USERS.FIELDS.USERNAME}]="${username}", CurrentValue.[${CONFIG.TABLES.USERS.FIELDS.PASSWORD}]="${password}")`,
          page_size: 1
        }
      }
    );

    if (response.data.code === 0) {
      const records = response.data.data.items;
      if (records && records.length > 0) {
        const user = records[0].fields;
        
        // 生成JWT
        const jwtToken = jwt.sign(
          { 
            username: user[CONFIG.TABLES.USERS.FIELDS.USERNAME],
            name: user[CONFIG.TABLES.USERS.FIELDS.NAME],
            permissions: user[CONFIG.TABLES.USERS.FIELDS.PERMISSIONS]
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.json({
          success: true,
          token: jwtToken,
          user: {
            username: user[CONFIG.TABLES.USERS.FIELDS.USERNAME],
            name: user[CONFIG.TABLES.USERS.FIELDS.NAME],
            permissions: user[CONFIG.TABLES.USERS.FIELDS.PERMISSIONS]
          }
        });
      } else {
        res.status(401).json({ message: '用户名或密码错误' });
      }
    } else {
      res.status(500).json({ message: '登录验证失败' });
    }
  } catch (error) {
    console.error('登录失败:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取产品列表
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const token = await getAccessToken();
    
    const response = await axios.get(
      `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${CONFIG.TABLES.PRODUCTS.APP_TOKEN}/tables/${CONFIG.TABLES.PRODUCTS.TABLE_ID}/records`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          page_size: 20
        }
      }
    );

    if (response.data.code === 0) {
      const records = response.data.data.items;
      const products = records.map(record => ({
        id: record.record_id,
        orderNumber: record.fields[CONFIG.TABLES.PRODUCTS.FIELDS.ORDER_NUMBER],
        creator: record.fields[CONFIG.TABLES.PRODUCTS.FIELDS.CREATOR],
        status: record.fields[CONFIG.TABLES.PRODUCTS.FIELDS.WORK_TYPE_1],
        operator: record.fields[CONFIG.TABLES.PRODUCTS.FIELDS.OPERATOR],
        createDate: record.fields[CONFIG.TABLES.PRODUCTS.FIELDS.CREATE_DATE],
        completeTime: record.fields[CONFIG.TABLES.PRODUCTS.FIELDS.WORK_TYPE_1_COMPLETE_TIME]
      }));

      res.json({ products });
    } else {
      res.status(500).json({ message: '获取产品数据失败' });
    }
  } catch (error) {
    console.error('获取产品数据失败:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 提交报工记录
app.post('/api/work-record', authenticateToken, async (req, res) => {
  try {
    const { orderNumber, workType, operator } = req.body;
    
    if (!orderNumber || !workType || !operator) {
      return res.status(400).json({ message: '订单编号、工序类型和操作人不能为空' });
    }

    const token = await getAccessToken();
    
    const recordData = {
      fields: {
        [CONFIG.TABLES.WORK_HISTORY.FIELDS.TIMESTAMP]: Date.now(),
        [CONFIG.TABLES.WORK_HISTORY.FIELDS.OPERATOR]: operator,
        [CONFIG.TABLES.WORK_HISTORY.FIELDS.ORDER_NUMBER]: orderNumber,
        [CONFIG.TABLES.WORK_HISTORY.FIELDS.WORK_TYPE]: workType,
        [CONFIG.TABLES.WORK_HISTORY.FIELDS.STATUS]: '正常'
      }
    };

    const response = await axios.post(
      `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${CONFIG.TABLES.WORK_HISTORY.APP_TOKEN}/tables/${CONFIG.TABLES.WORK_HISTORY.TABLE_ID}/records`,
      recordData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.code === 0) {
      res.json({
        success: true,
        recordId: response.data.data.record.record_id,
        message: '报工记录提交成功'
      });
    } else {
      res.status(500).json({ message: '提交报工记录失败' });
    }
  } catch (error) {
    console.error('提交报工记录失败:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取报工历史
app.get('/api/work-history', authenticateToken, async (req, res) => {
  try {
    const token = await getAccessToken();
    
    const response = await axios.get(
      `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${CONFIG.TABLES.WORK_HISTORY.APP_TOKEN}/tables/${CONFIG.TABLES.WORK_HISTORY.TABLE_ID}/records`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          page_size: 50
        }
      }
    );

    if (response.data.code === 0) {
      const records = response.data.data.items;
      const history = records.map(record => ({
        id: record.record_id,
        orderNumber: record.fields[CONFIG.TABLES.WORK_HISTORY.FIELDS.ORDER_NUMBER],
        operator: record.fields[CONFIG.TABLES.WORK_HISTORY.FIELDS.OPERATOR],
        workType: record.fields[CONFIG.TABLES.WORK_HISTORY.FIELDS.WORK_TYPE],
        status: record.fields[CONFIG.TABLES.WORK_HISTORY.FIELDS.STATUS],
        timestamp: record.fields[CONFIG.TABLES.WORK_HISTORY.FIELDS.TIMESTAMP]
      }));

      res.json({ history });
    } else {
      res.status(500).json({ message: '获取报工历史失败' });
    }
  } catch (error) {
    console.error('获取报工历史失败:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 管理员权限验证中间件
function requireAdmin(req, res, next) {
  if (req.user.username !== 'admin') {
    return res.status(403).json({ message: '需要管理员权限' });
  }
  next();
}

// 获取所有用户（管理员专用）
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const token = await getAccessToken();
    
    const response = await axios.get(
      `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${CONFIG.TABLES.USERS.APP_TOKEN}/tables/${CONFIG.TABLES.USERS.TABLE_ID}/records`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          page_size: 100
        }
      }
    );

    if (response.data.code === 0) {
      const records = response.data.data.items;
      const users = records
        .filter(record => record.fields && Object.keys(record.fields).length > 0)
        .map(record => ({
          id: record.record_id,
          username: record.fields[CONFIG.TABLES.USERS.FIELDS.USERNAME],
          password: record.fields[CONFIG.TABLES.USERS.FIELDS.PASSWORD],
          name: record.fields[CONFIG.TABLES.USERS.FIELDS.NAME],
          permissions: record.fields[CONFIG.TABLES.USERS.FIELDS.PERMISSIONS]
        }));

      res.json({ users });
    } else {
      res.status(500).json({ message: '获取用户列表失败' });
    }
  } catch (error) {
    console.error('获取用户列表失败:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 添加新用户（管理员专用）
app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, name, permissions } = req.body;
    
    if (!username || !password || !name) {
      return res.status(400).json({ message: '用户名、密码和姓名不能为空' });
    }

    const token = await getAccessToken();
    
    // 检查用户名是否已存在
    const checkResponse = await axios.get(
      `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${CONFIG.TABLES.USERS.APP_TOKEN}/tables/${CONFIG.TABLES.USERS.TABLE_ID}/records`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          filter: `CurrentValue.[${CONFIG.TABLES.USERS.FIELDS.USERNAME}]="${username}"`,
          page_size: 1
        }
      }
    );

    if (checkResponse.data.code === 0 && checkResponse.data.data.items.length > 0) {
      return res.status(400).json({ message: '用户名已存在' });
    }
    
    const recordData = {
      fields: {
        [CONFIG.TABLES.USERS.FIELDS.USERNAME]: username,
        [CONFIG.TABLES.USERS.FIELDS.PASSWORD]: password,
        [CONFIG.TABLES.USERS.FIELDS.NAME]: name,
        [CONFIG.TABLES.USERS.FIELDS.PERMISSIONS]: permissions || ''
      }
    };

    const response = await axios.post(
      `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${CONFIG.TABLES.USERS.APP_TOKEN}/tables/${CONFIG.TABLES.USERS.TABLE_ID}/records`,
      recordData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.code === 0) {
      res.json({
        success: true,
        userId: response.data.data.record.record_id,
        message: '用户添加成功'
      });
    } else {
      res.status(500).json({ message: '添加用户失败' });
    }
  } catch (error) {
    console.error('添加用户失败:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 编辑用户（管理员专用）
app.put('/api/admin/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, password, name, permissions } = req.body;
    
    if (!username || !password || !name) {
      return res.status(400).json({ message: '用户名、密码和姓名不能为空' });
    }

    const token = await getAccessToken();
    
    const recordData = {
      fields: {
        [CONFIG.TABLES.USERS.FIELDS.USERNAME]: username,
        [CONFIG.TABLES.USERS.FIELDS.PASSWORD]: password,
        [CONFIG.TABLES.USERS.FIELDS.NAME]: name,
        [CONFIG.TABLES.USERS.FIELDS.PERMISSIONS]: permissions || ''
      }
    };

    const response = await axios.put(
      `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${CONFIG.TABLES.USERS.APP_TOKEN}/tables/${CONFIG.TABLES.USERS.TABLE_ID}/records/${userId}`,
      recordData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.code === 0) {
      res.json({
        success: true,
        message: '用户信息更新成功'
      });
    } else {
      res.status(500).json({ message: '更新用户信息失败' });
    }
  } catch (error) {
    console.error('更新用户信息失败:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 删除用户（管理员专用）
app.delete('/api/admin/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const token = await getAccessToken();

    const response = await axios.delete(
      `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${CONFIG.TABLES.USERS.APP_TOKEN}/tables/${CONFIG.TABLES.USERS.TABLE_ID}/records/${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.code === 0) {
      res.json({
        success: true,
        message: '用户删除成功'
      });
    } else {
      res.status(500).json({ message: '删除用户失败' });
    }
  } catch (error) {
    console.error('删除用户失败:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取数据表汇总信息（管理员专用）
app.get('/api/admin/tables-summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const token = await getAccessToken();
    const summary = {
      tables: [
        {
          name: '用户表',
          tableId: CONFIG.TABLES.USERS.TABLE_ID,
          appToken: CONFIG.TABLES.USERS.APP_TOKEN,
          purpose: '用户登录验证和权限管理',
          fields: Object.values(CONFIG.TABLES.USERS.FIELDS),
          permissions: '管理员可编辑',
          recordCount: 0
        },
        {
          name: '产品表',
          tableId: CONFIG.TABLES.PRODUCTS.TABLE_ID,
          appToken: CONFIG.TABLES.PRODUCTS.APP_TOKEN,
          purpose: '产品信息和报工状态',
          fields: Object.values(CONFIG.TABLES.PRODUCTS.FIELDS),
          permissions: '所有用户只读',
          recordCount: 0
        },
        {
          name: '报工历史表',
          tableId: CONFIG.TABLES.WORK_HISTORY.TABLE_ID,
          appToken: CONFIG.TABLES.WORK_HISTORY.APP_TOKEN,
          purpose: '报工记录历史',
          fields: Object.values(CONFIG.TABLES.WORK_HISTORY.FIELDS),
          permissions: '所有用户只读',
          recordCount: 0
        }
      ]
    };

    // 获取各表记录数量
    for (let table of summary.tables) {
      try {
        const response = await axios.get(
          `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${table.appToken}/tables/${table.tableId}/records`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            params: {
              page_size: 1
            }
          }
        );
        
        if (response.data.code === 0) {
          table.recordCount = response.data.data.total || 0;
        }
      } catch (error) {
        console.error(`获取${table.name}记录数失败:`, error.message);
      }
    }

    res.json(summary);
  } catch (error) {
    console.error('获取表格汇总信息失败:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 通用表格数据访问端点（用于前端网络测试）
app.get('/api/bitable/v1/apps/:appToken/tables/:tableId/records', async (req, res) => {
  try {
    const { appToken, tableId } = req.params;
    const token = await getAccessToken();
    
    const response = await axios.get(
      `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: req.query
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('获取表格数据失败:', error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ message: '服务器错误' });
    }
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 API服务器已启动在端口 ${PORT}`);
  console.log(`📡 API地址: http://localhost:${PORT}/api`);
  console.log(`🔗 测试页面: http://localhost:3000`);
  console.log('\n📋 可用的API端点:');
  console.log('  GET  /api/status        - 系统状态');
  console.log('  POST /api/login         - 用户登录');
  console.log('  GET  /api/products      - 获取产品列表');
  console.log('  POST /api/work-record   - 提交报工记录');
  console.log('  GET  /api/work-history  - 获取报工历史');
  console.log('  GET  /api/admin/users   - 获取所有用户');
  console.log('  POST /api/admin/users   - 添加新用户');
  console.log('  PUT   /api/admin/users/:userId - 编辑用户');
  console.log('  DELETE /api/admin/users/:userId - 删除用户');
  console.log('  GET   /api/admin/tables-summary - 获取数据表汇总信息');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭API服务器...');
  process.exit(0);
}); 