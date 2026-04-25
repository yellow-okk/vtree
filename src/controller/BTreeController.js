import { BTree } from "../core/BTree.js";
import { ViewManager } from "../view/ViewManager.js";
import { layoutEngine } from "../layout/LayoutEngine.js";
import { AnimationPlayer } from "../animation/AnimationPlayer.js";

export default class BTreeController {
    constructor(bTree) {
        this.bTree = bTree;
        this.degree = 3;
        this.viewManager = null;
        this.animationPlayer = null;

        // 绑定事件处理方法的this
        this.handleInsert = this.handleInsert.bind(this);
        this.handleDelete = this.handleDelete.bind(this);
        this.handleClear = this.handleClear.bind(this);
    }

    async initModules() {
        //1
        // this.bTree = new BTree(this.degree);
        //2
        const appDom = document.getElementById("app");
        this.viewManager = new ViewManager(appDom);
        await this.viewManager.init();
        //3 layoutEngine是实例导出
        //4
        this.animationPlayer = new AnimationPlayer(this.viewManager);
    }

    initInput() {
        const degreeSlider = document.getElementById("degreeSlider");
        const degreeValue = document.getElementById("degreeValue");

        degreeSlider.addEventListener("input", (event) => {
            degreeValue.textContent = event.target.value;
            this.degree = parseInt(event.target.value, 10);
            this.handleClear();
            console.log("当前阶数:", this.degree);
        });

        document.addEventListener("DOMContentLoaded", () => {
            const insertBtn = document.getElementById("insertBtn");
            const deleteBtn = document.getElementById("deleteBtn");
            const clearBtn = document.getElementById("clearBtn");

            insertBtn.addEventListener("click", this.handleInsert);
            deleteBtn.addEventListener("click", this.handleDelete);
            clearBtn.addEventListener("click", this.handleClear);
        });
    }

    /**
     * 禁用UI元素
     */
    disableUI() {
        document.getElementById("insertBtn").disabled = true;
        document.getElementById("deleteBtn").disabled = true;
        document.getElementById("clearBtn").disabled = true;
        document.getElementById("insertInput").disabled = true;
        document.getElementById("deleteInput").disabled = true;
        document.getElementById("degreeSlider").disabled = true;
    }

    /**
     * 启用UI元素
     */
    enableUI() {
        document.getElementById("insertBtn").disabled = false;
        document.getElementById("deleteBtn").disabled = false;
        document.getElementById("clearBtn").disabled = false;
        document.getElementById("insertInput").disabled = false;
        document.getElementById("deleteInput").disabled = false;
        document.getElementById("degreeSlider").disabled = false;
    }

    handleInsert() {
        const inputElement = document.getElementById("insertInput");
        const value = inputElement.value;
        const numberValue = parseInt(value, 10);

        const cNode = this.viewManager.currentNodeViews.get("node-1");
        if (cNode) {
            console.log("当前节点:", cNode);
        } else {
            console.log("根节点不存在");
        }

        console.log(`========插入值: ${numberValue}========`);
        // 调用BTree插入方法，获取命令队列
        // console.log("---zhi前BTree:", this.bTree);
        const commandQueue = this.bTree.insert(numberValue);
        console.log("当前BTree:", this.bTree);
        // console.log("Btree插入命令队列:", commandQueue);

        // 布局和渲染逻辑
        const positions = layoutEngine.calculate(this.bTree);
        console.log("插入后的位置:", positions);

        // 锁定UI，防止动画期间用户乱点
        this.disableUI();

        this.animationPlayer.play(commandQueue, positions, this.bTree, 1, () => {
            
            this.enableUI();
        });

        // 清空输入框
        inputElement.value = "";
    }

    handleDelete() {
        const inputElement = document.getElementById("deleteInput");
        const value = inputElement.value;

        const numberValue = parseInt(value, 10);
        console.log(`========删除值: ${numberValue}========`);
        // 调用删除方法，获取命令队列
        const commandQueue = this.bTree.delete(numberValue);
        console.log("Btree删除命令队列:", commandQueue);
        // 布局和渲染逻辑
        const positions = layoutEngine.calculate(this.bTree);
        // console.log("删除后的位置:", positions);

        // 锁定UI，防止动画期间用户乱点
        this.disableUI();

        // 开始播放动画序列
        this.animationPlayer.play(commandQueue, positions, this.bTree, 1, () => {
            
            this.enableUI();
        });

        inputElement.value = "";
    }

    handleClear() {
        document.getElementById("insertInput").value = "";
        document.getElementById("deleteInput").value = "";

        // 重置滑动条
        // document.getElementById("degreeSlider").value = "3";
        // document.getElementById("degreeValue").textContent = "3";

        // 清空视图资源
        if (this.viewManager) {
            this.viewManager.clear();
        }

        // 重新初始化数据
        this.bTree = null;
        this.bTree = new BTree(this.degree);

        console.log("清空所有数据");
    }

    sbInsert() {
        const inputElement = document.getElementById("insertInput");
        const value = inputElement.value;

        // 转换为数字类型
        const numberValue = parseInt(value, 10);

        // 处理插入逻辑
        console.log(`========插入值: ${numberValue}========`);
        // 这里调用你的BTree插入方法
        this.bTree.insert(numberValue);
        const positions = layoutEngine.calculate(this.bTree);
        console.log("插入后的位置:", positions);
        let nodeList = this.bTree.traverseNode();
        this.viewManager.clearStage();
        for (const node of nodeList) {
            let pos = positions[node.id];
            this.viewManager.createNodeView(node.keys, node.id, pos.x, pos.y);

            console.log("节点ID:", node.id, "键值:", node.keys);
        }
        this.viewManager.renderEdgeOnce(this.bTree);
        console.log(this.viewManager.currentNodeViews);
        // 清空输入框
        inputElement.value = "";
    }
}
