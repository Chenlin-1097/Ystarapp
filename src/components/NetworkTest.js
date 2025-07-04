import React, { useState, useEffect } from 'react';
import { Button, Card, Typography, Space, Alert, Spin, Descriptions } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { FeishuService } from '../services/FeishuService';
import { CONFIG } from '../config/config';

const { Title, Text, Paragraph } = Typography;

const NetworkTest = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState({});

  const runNetworkTest = async () => {
    setTesting(true);
    const testResults = {};

    try {
      // 测试1: 基本网络连接
      console.log('🔍 测试1: 基本网络连接');
      testResults.basicConnection = await testBasicConnection();

      // 测试2: 直接访问飞书域名
      console.log('🔍 测试2: 直接访问飞书域名');
      testResults.feishuDomain = await testFeishuDomain();

      // 测试3: Netlify Functions测试
      console.log('🔍 测试3: Netlify Functions测试');
      testResults.netlifyFunctions = await testNetlifyFunctions();

      // 测试4: 飞书API认证
      console.log('🔍 测试4: 飞书API认证');
      testResults.feishuAuth = await testFeishuAuth();

      // 测试5: 用户表格访问
      console.log('🔍 测试5: 用户表格访问');
      testResults.userTableAccess = await testUserTableAccess();

    } catch (error) {
      console.error('❌ 测试过程中发生错误:', error);
    }

    setResults(testResults);
    setTesting(false);
  };

  const testBasicConnection = async () => {
    try {
      const response = await fetch('https://www.baidu.com', { 
        mode: 'no-cors',
        method: 'HEAD'
      });
      return { success: true, message: '✅ 基本网络连接正常' };
    } catch (error) {
      return { success: false, message: '❌ 基本网络连接失败: ' + error.message };
    }
  };

  const testFeishuDomain = async () => {
    try {
      const response = await fetch('https://open.feishu.cn', { 
        mode: 'no-cors',
        method: 'HEAD'
      });
      return { success: true, message: '✅ 飞书域名访问正常' };
    } catch (error) {
      return { success: false, message: '❌ 飞书域名访问失败: ' + error.message };
    }
  };

  const testNetlifyFunctions = async () => {
    try {
      console.log('🚀 测试Netlify Functions');
      
      // 在开发环境中，如果没有运行netlify dev，这个测试会失败
      // 在生产环境中，这个应该能正常工作
      const response = await fetch('/.netlify/functions/feishu-api/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: CONFIG.FEISHU.APP_ID,
          app_secret: CONFIG.FEISHU.APP_SECRET
        })
      });

      console.log('📊 Netlify Functions响应状态:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Netlify Functions响应数据:', data);
        
        if (data.code === 0) {
          return { 
            success: true, 
            message: `✅ Netlify Functions正常工作`,
            details: `获取到访问令牌，过期时间: ${data.expire}秒`
          };
        } else {
          return { 
            success: false, 
            message: `❌ Netlify Functions返回错误`,
            details: `错误: ${data.msg || '未知错误'}`
          };
        }
      } else {
        const errorText = await response.text();
        return { 
          success: false, 
          message: `❌ Netlify Functions HTTP错误`,
          details: `状态码: ${response.status}, 错误: ${errorText}`
        };
      }
    } catch (error) {
      console.error('❌ Netlify Functions测试错误:', error);
      return { 
        success: false, 
        message: '❌ Netlify Functions测试错误: ' + error.message,
        details: '这可能是因为本地没有运行 netlify dev，在生产环境中应该正常工作'
      };
    }
  };

  const testFeishuAuth = async () => {
    try {
      const result = await FeishuService.checkConnection();
      return { 
        success: result, 
        message: result ? '✅ 飞书API认证成功' : '❌ 飞书API认证失败' 
      };
    } catch (error) {
      return { 
        success: false, 
        message: '❌ 飞书API认证错误: ' + error.message,
        details: error.response?.data || error.stack
      };
    }
  };

  const testUserTableAccess = async () => {
    try {
      const data = await FeishuService.getTableData(
        CONFIG.TABLES.USERS.APP_TOKEN,
        CONFIG.TABLES.USERS.TABLE_ID
      );
      return { 
        success: true, 
        message: `✅ 用户表格访问正常，共${data.length}条记录` 
      };
    } catch (error) {
      return { 
        success: false, 
        message: '❌ 用户表格访问失败: ' + error.message,
        details: error.response?.data || error.stack
      };
    }
  };

  useEffect(() => {
    runNetworkTest();
  }, []);

  const renderTestResult = (testName, result) => {
    if (!result) {
      return (
        <Alert
          message={testName}
          description="测试中..."
          type="info"
          showIcon
          icon={<Spin size="small" />}
        />
      );
    }

    return (
      <Alert
        message={testName}
        description={
          <div>
            <div>{result.message}</div>
            {result.details && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                详情: {result.details}
              </div>
            )}
          </div>
        }
        type={result.success ? "success" : "error"}
        showIcon
        icon={result.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
      />
    );
  };

  return (
    <Card title="🔧 网络连接诊断" style={{ maxWidth: 900, margin: '20px auto' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Title level={4}>📋 系统配置信息</Title>
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="飞书应用ID">{CONFIG.FEISHU.APP_ID}</Descriptions.Item>
            <Descriptions.Item label="飞书应用密钥">{CONFIG.FEISHU.APP_SECRET?.substring(0, 10)}***</Descriptions.Item>
            <Descriptions.Item label="API基础地址">https://open.feishu.cn/open-apis</Descriptions.Item>
            <Descriptions.Item label="连接方式">Netlify Functions (/.netlify/functions/feishu-api)</Descriptions.Item>
            <Descriptions.Item label="用户表Token">{CONFIG.TABLES.USERS.APP_TOKEN}</Descriptions.Item>
            <Descriptions.Item label="用户表ID">{CONFIG.TABLES.USERS.TABLE_ID}</Descriptions.Item>
            <Descriptions.Item label="产品表Token">{CONFIG.TABLES.PRODUCTS.APP_TOKEN}</Descriptions.Item>
            <Descriptions.Item label="产品表ID">{CONFIG.TABLES.PRODUCTS.TABLE_ID}</Descriptions.Item>
          </Descriptions>
        </div>

        <div>
          <Title level={4}>🔍 连接测试结果</Title>
          <Space direction="vertical" style={{ width: '100%' }}>
            {renderTestResult('1️⃣ 基本网络连接', results.basicConnection)}
            {renderTestResult('2️⃣ 飞书域名访问', results.feishuDomain)}
            {renderTestResult('3️⃣ Netlify Functions测试', results.netlifyFunctions)}
            {renderTestResult('4️⃣ 飞书API认证', results.feishuAuth)}
            {renderTestResult('5️⃣ 用户表格访问', results.userTableAccess)}
          </Space>
        </div>

        <Button 
          type="primary" 
          icon={<ReloadOutlined />} 
          loading={testing}
          onClick={runNetworkTest}
          size="large"
        >
          🔄 重新测试
        </Button>
      </Space>
    </Card>
  );
};

export default NetworkTest; 