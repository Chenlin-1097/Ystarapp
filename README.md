# 在线扫码报工系统

一个基于React和飞书多维表格的在线报工系统，使用Netlify Functions解决CORS跨域问题。

## 功能特性

- 🔐 用户登录验证
- 📱 扫码报工
- 📊 工作进度跟踪
- 📈 报工历史记录
- 👥 用户权限管理
- 🔧 网络连接诊断

## 技术栈

- **前端**: React, Ant Design
- **API代理**: Netlify Functions
- **数据存储**: 飞书多维表格
- **部署**: Netlify (一体化部署)

## 本地开发

### 前置要求

- Node.js 18+
- npm 或 yarn
- Netlify CLI (用于本地Functions开发)

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env` 并填入配置：

```bash
cp .env.example .env
```

配置以下环境变量：
- `FEISHU_APP_ID`: 飞书应用ID
- `FEISHU_APP_SECRET`: 飞书应用密钥
- `REACT_APP_FEISHU_APP_ID`: 前端使用的飞书应用ID
- `REACT_APP_FEISHU_APP_SECRET`: 前端使用的飞书应用密钥

### 启动开发服务器

使用Netlify CLI启动（推荐，包含Functions）：
```bash
npm run dev:netlify
```

或者仅启动React开发服务器：
```bash
npm start
```

## 部署指南

### Netlify一键部署

1. **推送代码到GitHub**
2. **在Netlify中连接GitHub仓库**
3. **配置构建设置**：
   - 构建命令: `npm run build`
   - 发布目录: `build`
   - Functions目录: `netlify/functions`
4. **添加环境变量**（在Netlify dashboard中）：
   - `FEISHU_APP_ID`
   - `FEISHU_APP_SECRET`

### 环境变量配置

在Netlify Dashboard的 **Site settings > Environment variables** 中添加：

```
FEISHU_APP_ID=你的飞书应用ID
FEISHU_APP_SECRET=你的飞书应用密钥
```

## 架构说明

### 无服务器架构

本项目采用无服务器架构，通过Netlify Functions解决跨域问题：

```
浏览器 → React应用 → Netlify Functions → 飞书API
```

**优势**：
- 🚀 无需维护独立后端服务器
- 💰 成本更低（按需付费）
- 🔒 自动处理CORS问题
- ⚡ 全球CDN加速
- 🛡️ 自动HTTPS和安全防护

### 文件结构

```
├── public/                    # 静态文件
├── src/
│   ├── components/            # React组件
│   ├── services/              # API服务
│   ├── config/                # 配置文件
│   └── App.js                # 主应用
├── netlify/
│   └── functions/
│       └── feishu-api.js     # Netlify Functions API代理
├── netlify.toml              # Netlify配置
└── package.json              # 项目依赖
```

## 网络连接问题排查

如果遇到API连接问题，请检查：

1. **Netlify Functions是否正常部署**
2. **环境变量是否正确配置**
3. **飞书应用权限是否足够**
4. **网络防火墙设置**

访问 `/network-test` 页面可以进行连接诊断。

### 常见问题

**Q: 本地开发时Netlify Functions无法访问？**
A: 需要使用 `netlify dev` 命令启动，或者运行 `npm run dev:netlify`

**Q: 部署后Functions报错？**
A: 检查Netlify Dashboard中的Functions日志，确保环境变量已正确配置

**Q: 飞书API调用失败？**
A: 确认飞书应用的权限设置，需要多维表格读写权限

## 开发指南

### 添加新的API端点

1. 在 `netlify/functions/feishu-api.js` 中添加路由处理
2. 在 `src/services/FeishuService.js` 中添加对应的方法
3. 测试API调用是否正常工作

### 本地测试Functions

```bash
# 安装Netlify CLI
npm install -g netlify-cli

# 登录Netlify
netlify login

# 启动本地开发服务器（包含Functions）
netlify dev
```

## 许可证

MIT License 