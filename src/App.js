import React, { useState, useEffect } from 'react';
import { Layout, message } from 'antd';
import LoginPage from './components/LoginPage';
import MainWorkspace from './components/MainWorkspace';
import NetworkTest from './components/NetworkTest';
import { FeishuService } from './services/FeishuService';
import './App.css';

const { Header, Content } = Layout;

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [networkStatus, setNetworkStatus] = useState('checking');
  const [showNetworkTest, setShowNetworkTest] = useState(false);

  useEffect(() => {
    // 检查网络状态
    checkNetworkStatus();
    const interval = setInterval(checkNetworkStatus, 30000); // 每30秒检查一次
    
    return () => clearInterval(interval);
  }, []);

  const checkNetworkStatus = async () => {
    try {
      const isOnline = await FeishuService.checkConnection();
      setNetworkStatus(isOnline ? 'online' : 'offline');
    } catch (error) {
      setNetworkStatus('offline');
    }
  };

  const handleLogin = async (username, password) => {
    try {
      const user = await FeishuService.login(username, password);
      if (user) {
        setCurrentUser(user);
        setIsLoggedIn(true);
        message.success('登录成功！');
        return true;
      } else {
        message.error('用户名或密码错误');
        return false;
      }
    } catch (error) {
      message.error('登录失败：' + error.message);
      return false;
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    message.info('已退出登录');
  };

  // 如果显示网络测试页面
  if (showNetworkTest) {
    return (
      <div className="app-container">
        <NetworkTest />
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={() => setShowNetworkTest(false)}>
            返回登录页面
          </button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="app-container">
        <LoginPage 
          onLogin={handleLogin} 
          networkStatus={networkStatus} 
          onShowNetworkTest={() => setShowNetworkTest(true)}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Layout className="main-layout">
        <Content>
          <MainWorkspace 
            user={currentUser}
            networkStatus={networkStatus}
            onLogout={handleLogout}
            onNetworkRetry={checkNetworkStatus}
          />
        </Content>
      </Layout>
    </div>
  );
}

export default App; 