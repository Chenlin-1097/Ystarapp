// 系统配置文件
export const CONFIG = {
  // 飞书应用配置
  FEISHU: {
    APP_ID: 'cli_a74001f855b0d00c',
    APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq',
    BASE_URL: 'https://open.feishu.cn/open-apis'
  },

  // 表格配置 - 使用从知识库获取的实际表格信息
  TABLES: {
    // 用户表格配置
    USERS: {
      APP_TOKEN: 'RQj7bH20uaeNegsdERUclgcInAd', // 从知识库获取的app_token
      TABLE_ID: 'tblxbOsA83hEZShA', // 用户表的table_id
      FIELDS: {
        INTERNAL_ID: '内部编号',
        USERNAME: '用户名',
        PASSWORD: '密码',
        NAME: '姓名',
        PERMISSIONS: '工序权限' // 多选字段，格式：["工序1","工序2","工序3","工序4"]
      }
    },

    // 产品数据表格配置
    PRODUCTS: {
      APP_TOKEN: 'RQj7bH20uaeNegsdERUclgcInAd', // 从知识库获取的app_token
      TABLE_ID: 'tblMpF28247NLFfX', // 数据表的table_id
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

    // 报工历史表格配置
    WORK_HISTORY: {
      APP_TOKEN: 'RQj7bH20uaeNegsdERUclgcInAd', // 从知识库获取的app_token
      TABLE_ID: 'tbleX1cEZVzUvx2P', // 历史表的table_id
      FIELDS: {
        TIMESTAMP: '报工时间',
        OPERATOR: '操作人',
        ORDER_NUMBER: '订单编号',
        WORK_TYPE: '工序类型',
        STATUS: '状态' // 正常/已撤销
      }
    }
  },

  // 系统配置
  SYSTEM: {
    // 防重复扫码时间间隔（毫秒）
    DUPLICATE_SCAN_INTERVAL: 2000,
    
    // 网络检查间隔（毫秒）
    NETWORK_CHECK_INTERVAL: 30000,
    
    // 工序类型列表
    WORK_TYPES: ['工序1', '工序2', '工序3', '工序4'],
    
    // 二维码最小长度
    QR_CODE_MIN_LENGTH: 5,
    
    // 分页配置
    PAGINATION: {
      PAGE_SIZE: 10,
      SHOW_SIZE_CHANGER: true,
      SHOW_QUICK_JUMPER: true
    }
  }
};

// 验证配置是否完整
export const validateConfig = () => {
  const errors = [];
  
  if (!CONFIG.TABLES.USERS.APP_TOKEN) {
    errors.push('用户表格APP_TOKEN未配置');
  }
  
  if (!CONFIG.TABLES.USERS.TABLE_ID) {
    errors.push('用户表格TABLE_ID未配置');
  }
  
  if (!CONFIG.TABLES.PRODUCTS.APP_TOKEN) {
    errors.push('产品表格APP_TOKEN未配置');
  }
  
  if (!CONFIG.TABLES.PRODUCTS.TABLE_ID) {
    errors.push('产品表格TABLE_ID未配置');
  }
  
  if (!CONFIG.TABLES.WORK_HISTORY.APP_TOKEN) {
    errors.push('报工历史表格APP_TOKEN未配置');
  }
  
  if (!CONFIG.TABLES.WORK_HISTORY.TABLE_ID) {
    errors.push('报工历史表格TABLE_ID未配置');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}; 