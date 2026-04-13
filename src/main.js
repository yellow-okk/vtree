import { BTree } from "./core/BTree.js";
// import { NODE_CONFIG, PIXI_APP_CONFIG_CONFIG } from "./config.js";
import { layoutEngine } from "./layout/LayoutEngine.js";
import { ViewManager } from "./view/ViewManager.js";
import { NodeView } from "./view/NodeView.js";
import { Container, Graphics, Application } from "pixi.js";

// ==========================================
// 辅助函数：递归打印树结构，用于验证逻辑正确性
// ==========================================
function printTreeStructure(node, prefix = "", isTail = true) {
    if (!node) return;

    console.log(
        prefix + (isTail ? "└── " : "├── ") + `[${node.id}] keys: ${JSON.stringify(node.keys)}`,
    );

    if (node.children.length > 0) {
        for (let i = 0; i < node.children.length; i++) {
            const isLast = i === node.children.length - 1;
            printTreeStructure(node.children[i], prefix + (isTail ? "    " : "│   "), isLast);
        }
    }
}

// ==========================================
// 开始测试
// ==========================================
function testBTreeCommands() {
    console.log("================ 开始测试 BTree 核心指令生成 ================");

    const bt = new BTree(3); // 3阶B树 (每个节点最多2个key，最少1个key)
    const testKeys = [2, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 111];

    // 1. 测试插入
    console.log("\n【1. 测试插入操作】");
    for (const key of testKeys) {
        console.log(`\n>>> 准备插入 key: ${key}`);

        // 核心调用：insert 现在会返回指令队列
        const commands = bt.insert(key);

        // 打印生成的指令
        if (commands.length === 0) {
            console.log("生成的指令: 无 (直接插入，未溢出)");
        } else {
            console.log(`生成的指令 (${commands.length} 条):`);
            commands.forEach((cmd) => {
                console.log(`  - ${cmd.type}`, cmd.payload);
            });
        }
    }

    console.log("\n【插入完成后的最终树形结构】");
    printTreeStructure(bt.root);

    // 2. 测试删除
    console.log("\n\n【2. 测试删除操作】");
    const keyToDelete = 50;
    console.log(`\n>>> 准备删除 key: ${keyToDelete}`);

    // 核心调用：delete 现在也会返回指令队列
    const deleteCommands = bt.delete(keyToDelete);

    if (deleteCommands.length === 0) {
        console.log("生成的指令: 无 (直接删除，未下溢)");
    } else {
        console.log(`生成的指令 (${deleteCommands.length} 条):`);
        deleteCommands.forEach((cmd) => {
            console.log(`  - ${cmd.type}`, cmd.payload);
        });
    }

    console.log("\n【删除完成后的最终树形结构】");
    printTreeStructure(bt.root);

    console.log("\n================ 测试结束 ================");
}

function testLayoutEngine() {
    console.log("================ 开始测试 LayoutEngine ================");
    const bt = new BTree(3); // 3阶B树 (每个节点最多2个key，最少1个key)
    const testKeys = [2, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 111];
    console.log("构建B树...");
    for (const key of testKeys) {
        bt.insert(key);
    }
    console.log("B树构建完成");
    console.log("开始布局...");
    const positions = layoutEngine.calculate(bt);
    console.log("布局完成");
    // console.log(positions);
    return { positions, bt };
}

async function testNodeView() {
    console.log("================ 开始测试 NodeView ================");
    const appDom = document.getElementById("app");
    const viewManager = new ViewManager(appDom);
    await viewManager.init();
    const { positions, bt } = testLayoutEngine();
    console.log(positions);
    console.log(bt);
    let nodeList = bt.traverseNode();
    for (const node of nodeList) {
        let pos = positions[node.id];
        let nodeView = new NodeView(node.keys);
        nodeView.position.set(pos.x, pos.y);
        viewManager.app.stage.addChild(nodeView);
        console.log(node.id, node.keys);
    }
}
(async () => {
    await testNodeView();
})();
