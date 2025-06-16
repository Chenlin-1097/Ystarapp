# 在线扫码报工系统

一个基于React和飞书多维表格的在线报工系统。

## 功能特性

- 🔐 用户登录验证
- 📱 扫码报工
- 📊 工作进度跟踪
- 📈 报工历史记录
- 👥 用户权限管理
- 🔧 网络连接诊断

## 技术栈

- **前端**: React, Ant Design
- **后端**: Node.js, Express
- **数据存储**: 飞书多维表格
- **部署**: Netlify (前端) + 后端服务器

## 本地开发

### 前置要求

- Node.js 18+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env` 并填入配置：

```bash
cp .env.example .env
```

### 启动开发服务器

启动前端开发服务器：
```bash
npm start
```

启动后端API服务器：
```bash
node server.js
```

## 部署指南

### Netlify部署

1. 将代码推送到GitHub
2. 在Netlify中连接GitHub仓库
3. 配置构建设置：
   - 构建命令: `npm run build`
   - 发布目录: `build`
4. 添加环境变量（在Netlify dashboard中）

### 后端部署

后端需要单独部署到支持Node.js的平台，如：
- Heroku
- Railway
- 腾讯云函数
- 阿里云函数计算

### 配置说明

- 确保飞书应用配置正确
- 后端API地址需要在生产环境中更新
- 所有敏感信息应通过环境变量配置

## 文件结构

```
├── public/             # 静态文件
├── src/
│   ├── components/     # React组件
│   ├── services/       # API服务
│   ├── config/         # 配置文件
│   └── App.js         # 主应用
├── server.js          # 后端服务器
├── netlify.toml       # Netlify配置
└── package.json       # 项目依赖
```

## 网络连接问题排查

如果遇到API连接问题，请检查：

1. 后端服务器是否正常运行
2. CORS配置是否正确
3. 飞书应用权限是否足够
4. 网络防火墙设置

访问 `/network-test` 页面可以进行连接诊断。

## 许可证

MIT License 