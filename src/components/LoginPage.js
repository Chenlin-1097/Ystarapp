import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Space, Badge } from 'antd';
import { UserOutlined, LockOutlined, WifiOutlined, ToolOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const LoginPage = ({ onLogin, networkStatus, onShowNetworkTest }) => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const success = await onLogin(values.username, values.password);
      if (!success) {
        form.setFields([
          {
            name: 'password',
            errors: ['用户名或密码错误'],
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getNetworkStatusInfo = () => {
    switch (networkStatus) {
      case 'online':
        return { status: 'success', text: '网络连接正常' };
      case 'offline':
        return { status: 'error', text: '网络连接失败' };
      case 'checking':
        return { status: 'processing', text: '检查网络连接中...' };
      default:
        return { status: 'default', text: '未知状态' };
    }
  };

  const networkInfo = getNetworkStatusInfo();

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card 
        style={{ 
          width: 400, 
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          borderRadius: '12px'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ color: '#1890ff', marginBottom: 8 }}>
            扫码报工系统
          </Title>
          <Text type="secondary">请输入您的登录凭据</Text>
        </div>

        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <Badge status={networkInfo.status} />
          <Text style={{ marginLeft: 8 }}>{networkInfo.text}</Text>
          {networkStatus === 'offline' && onShowNetworkTest && (
            <div style={{ marginTop: 8 }}>
              <Button 
                size="small" 
                type="link" 
                icon={<ToolOutlined />}
                onClick={onShowNetworkTest}
              >
                网络诊断
              </Button>
            </div>
          )}
        </div>

        <Form
          form={form}
          name="login"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[
              {
                required: true,
                message: '请输入用户名!',
              },
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="用户名" 
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              {
                required: true,
                message: '请输入密码!',
              },
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              disabled={networkStatus === 'offline'}
              style={{ width: '100%', height: '40px' }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            测试账号: test / 123456
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage; 