const { spawn } = require('child_process');
const axios = require('axios');

console.log('🚀 启动完整的在线扫码报工系统\n');
console.log('=' .repeat(50));

// 检查系统状态
async function checkSystemStatus() {
  console.log('🔍 正在检查系统状态...\n');
  
  try {
    // 检查飞书API连接
    console.log('1. 检查飞书API连接...');
    const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: 'cli_a74001f855b0d00c',
      app_secret: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq'
    });

    if (response.data.code === 0) {
      console.log('✅ 飞书API连接正常');
      return true;
    } else {
      console.log('❌ 飞书API连接失败:', response.data.msg);
      return false;
    }
  } catch (error) {
    console.log('❌ 系统检查失败:', error.message);
    return false;
  }
}

// 启动API服务器
function startAPIServer() {
  console.log('\n🔧 启动API服务器 (端口 3001)...');
  
  const apiProcess = spawn('node', ['server.js'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  });

  apiProcess.stdout.on('data', (data) => {
    console.log(`[API] ${data.toString().trim()}`);
  });

  apiProcess.stderr.on('data', (data) => {
    console.error(`[API错误] ${data.toString().trim()}`);
  });

  apiProcess.on('close', (code) => {
    console.log(`\n[API] 服务器已退出，退出码: ${code}`);
  });

  return apiProcess;
}

// 启动React应用
function startReactApp() {
  console.log('\n⚛️  启动React应用 (端口 3000)...');
  
  const reactProcess = spawn('npm', ['start'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  });

  reactProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.log(`[React] ${output}`);
    }
  });

  reactProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output && !output.includes('webpack compiled')) {
      console.error(`[React错误] ${output}`);
    }
  });

  reactProcess.on('close', (code) => {
    console.log(`\n[React] 应用已退出，退出码: ${code}`);
  });

  return reactProcess;
}

// 等待服务器启动
function waitForServer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkServer = async () => {
      try {
        await axios.get(url);
        resolve();
      } catch (error) {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`服务器启动超时: ${url}`));
        } else {
          setTimeout(checkServer, 1000);
        }
      }
    };
    
    checkServer();
  });
}

// 主函数
async function main() {
  try {
    // 检查系统状态
    const systemOk = await checkSystemStatus();
    
    if (!systemOk) {
      console.log('⚠️  系统检查未通过，但继续启动服务...\n');
    }

    // 启动API服务器
    const apiProcess = startAPIServer();
    
    // 等待API服务器启动
    console.log('\n⏳ 等待API服务器启动...');
    try {
      await waitForServer('http://localhost:3001/api/status', 15000);
      console.log('✅ API服务器启动成功！');
    } catch (error) {
      console.log('⚠️  API服务器启动可能有问题，但继续启动React应用...');
    }

    // 启动React应用
    const reactProcess = startReactApp();
    
    // 等待React应用启动
    console.log('\n⏳ 等待React应用启动...');
    try {
      await waitForServer('http://localhost:3000', 30000);
      console.log('✅ React应用启动成功！');
    } catch (error) {
      console.log('⚠️  React应用启动可能有问题...');
    }

    // 显示使用说明
    console.log('\n' + '='.repeat(50));
    console.log('🎉 系统启动完成！');
    console.log('\n📖 使用说明：');
    console.log('1. React前端应用: http://localhost:3000');
    console.log('2. API后端服务: http://localhost:3001');
    console.log('3. 在线测试页面: https://mcp.edgeone.site/share/dNBGHeB1oIVu70ixlbXTb');
    console.log('\n👤 测试账号：');
    console.log('• 管理员: admin / admin123456 (所有权限)');
    console.log('• 测试用户: test / 123456 (工序1权限)');
    console.log('\n💡 提示：');
    console.log('• 按 Ctrl+C 停止所有服务');
    console.log('• 所有数据都会同步到飞书多维表格');
    console.log('• 可以在多个浏览器标签页中同时使用');
    console.log('\n' + '='.repeat(50));

    // 处理退出信号
    process.on('SIGINT', () => {
      console.log('\n\n🛑 正在关闭所有服务...');
      
      if (apiProcess && !apiProcess.killed) {
        console.log('关闭API服务器...');
        apiProcess.kill('SIGINT');
      }
      
      if (reactProcess && !reactProcess.killed) {
        console.log('关闭React应用...');
        reactProcess.kill('SIGINT');
      }
      
      setTimeout(() => {
        console.log('✅ 所有服务已关闭');
        process.exit(0);
      }, 2000);
    });

    // 保持进程运行
    process.stdin.resume();

  } catch (error) {
    console.error('❌ 启动过程中发生错误:', error.message);
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error('❌ 启动失败:', error.message);
  process.exit(1);
}); 