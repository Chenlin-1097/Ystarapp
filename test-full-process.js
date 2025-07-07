const lark = require('@larksuiteoapi/node-sdk');
const ExcelImporter = require('./src/services/ExcelImportService');
const path = require('path');

async function main() {
  try {
    // 初始化SDK客户端
    const client = new lark.Client({
      appId: 'cli_a74001f855b0d00c',
      appSecret: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq'
    });
    
    // 1. 分片上传Excel并导入
    console.log('🚀 第一步：上传并导入Excel文件...');
    const filePath = 'WSD2715线上款式明细.xlsx';
    const importer = new ExcelImporter({
      APP_ID: 'cli_a74001f855b0d00c',
      APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq'
    });
    const importResult = await importer.importFile(filePath);
    console.log('✅ Excel导入成功！');
    console.log('文档Token:', importResult.token);
    console.log('文档链接:', importResult.url);

    // 等待3秒，确保文档已经完全创建
    console.log('⏳ 等待文档创建完成...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 2. 移动到Wiki节点
    console.log('\n🚀 第二步：移动到Wiki节点...');
    const spaceId = '7368294892111626244';  // 知识库ID
    const parentNodeToken = 'O20dw9tvficXm0kffTWc9qojnOf';  // 父节点token

    // 先获取文档信息
    console.log('🔍 获取文档信息...');
    const docResponse = await client.request({
      url: `/open-apis/sheets/v2/spreadsheets/${importResult.token}/metainfo`,
      method: 'GET'
    });

    if (docResponse.code !== 0) {
      throw new Error(`获取文档信息失败: ${docResponse.msg}`);
    }

    console.log('✅ 获取到文档信息:', {
      标题: docResponse.data.title,
      类型: 'sheet',
      Token: importResult.token
    });

    const moveResponse = await client.wiki.v2.spaceNode.moveDocsToWiki({
      path: {
        space_id: spaceId
      },
      data: {
        parent_wiki_token: parentNodeToken,
        obj_type: 'sheet',  // 修改为sheet类型
        obj_token: importResult.token
      }
    });

    if (moveResponse.code !== 0) {
      throw new Error(`移动文档失败: ${moveResponse.msg}`);
    }

    // 如果直接返回wiki_token，说明操作已完成
    if (moveResponse.data.wiki_token) {
      console.log('✅ 文档移动完成！');
      console.log('Wiki Token:', moveResponse.data.wiki_token);
      return;
    }

    // 如果返回task_id，需要轮询检查任务状态
    if (moveResponse.data.task_id) {
      console.log('⏳ 移动任务已创建，等待完成...');
      console.log('任务ID:', moveResponse.data.task_id);
      
      let attempts = 0;
      const maxAttempts = 20;
      
      while (attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
        
        const taskResponse = await client.wiki.v2.task.get({
          path: {
            task_id: moveResponse.data.task_id
          },
          params: {
            task_type: 'move'
          }
        });

        if (taskResponse.code !== 0) {
          throw new Error(`查询任务状态失败: ${taskResponse.msg}`);
        }

        const task = taskResponse.data.task;
        if (!task || !task.move_result || task.move_result.length === 0) {
          console.log(`⏳ 移动任务处理中... (${attempts}/${maxAttempts})`);
          continue;
        }

        // 检查每个节点的状态
        const results = task.move_result.map(result => {
          const status = result.status === 0 ? '成功' : `失败: ${result.status_msg}`;
          const node = result.node;
          return {
            标题: node.title,
            状态: status,
            节点Token: node.node_token,
            文档Token: node.obj_token
          };
        });

        console.log('📊 移动结果:', JSON.stringify(results, null, 2));

        // 如果所有节点都成功移动
        if (task.move_result.every(r => r.status === 0)) {
          console.log('✅ 所有文档移动成功！');
          return;
        }

        throw new Error('部分文档移动失败，请查看详细结果');
      }

      throw new Error(`移动任务状态查询超时（${maxAttempts}次尝试后），请手动检查结果`);
    }

    // 如果返回applied，说明已发出申请
    if (moveResponse.data.applied) {
      console.log('📨 已发出移动申请，等待审批...');
      return;
    }

    throw new Error('未知的响应格式');
  } catch (error) {
    console.error('❌ 流程执行失败:', error.message);
    process.exit(1);
  }
}

main(); 