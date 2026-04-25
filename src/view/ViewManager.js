import { PIXI_APP_CONFIG, NODE_CONFIG } from "../config.js";
import { Application, Graphics } from "pixi.js";
import { NodeView } from "./NodeView.js";
import { renderTreeEdge } from "./EdgeRenderer.js";

export class ViewManager {
    constructor(targetDom = document.body) {
        this.app = new Application();
        this.targetDom = targetDom;
        this.currentNodeViews = new Map();
        this.futureNodeViews = new Map(); //未来节点视图,有可能有用
        this.edgeGraphics = new Graphics();
        this.edgeStyle = {
            width: NODE_CONFIG.edgeWidth,
            color: NODE_CONFIG.lineColor,
        };
    }

    async init() {
        await this.app.init(PIXI_APP_CONFIG);
        this.targetDom.appendChild(this.app.canvas);
        this.app.stage.addChildAt(this.edgeGraphics, 0);
    }

    renderEdgeOnce(tree) {
        renderTreeEdge(tree, this.currentNodeViews, this.edgeGraphics, this.edgeStyle);
        this.app.stage.addChildAt(this.edgeGraphics, 0);
        console.log(this.app.stage);
        // console.log(this.edgeGraphics);
    }

    renderEdgeContinuously(tree) {
        // 直接更新连线，不需要重复添加到舞台
        renderTreeEdge(tree, this.currentNodeViews, this.edgeGraphics, this.edgeStyle);
    }

    // renderAllNodeViews() { //错的
    //     this.tree.traverseNodes.map((node) => {
    //         this.createNodeView(node.keyValues, node.id, node.x, node.y);
    //     });
    // }
    clearStage() {
        console.log(this.app.stage.children.length);
        if (this.app.stage.children.length > 1) {
            this.app.stage.removeChildren(1);
        } else {
            this.app.stage.removeChildren();
        }
    }

    createNodeView(keyValues, dataNodeId, x, y) {
        console.log("创建节点视图:", keyValues, dataNodeId, x, y);
        const nodeView = new NodeView(keyValues, dataNodeId, x, y);
        nodeView.position.set(x, y);
        this.currentNodeViews.set(dataNodeId, nodeView);
        this.app.stage.addChild(nodeView);
        return nodeView;
    }

    removeNodeView(dataNodeId) {
        const nodeView = this.currentNodeViews.get(dataNodeId);
        if (nodeView) {
            this.app.stage.removeChild(nodeView);
            this.currentNodeViews.delete(dataNodeId);
        }
    }
    syncNodeForAnimation(id, newKeys) {
        const nodeView = this.getCurrentNodeView(id);
        if (nodeView) {
            nodeView.updateKeysAndRender(newKeys);
        }
    }

    getCurrentNodeView(nodeId) {
        return this.currentNodeViews.get(nodeId);
    }

    getFutureNodeView(nodeId) {
        return this.futureNodeViews.get(nodeId);
    }

    syncCurrentNodeView(nodeId) {
        this.currentNodeViews.set(nodeId, this.getFutureNodeView(nodeId));
    }

    // 清空所有视图资源
    clear() {
        // 1. 清空Map
        this.currentNodeViews.forEach((nodeView) => {
            this.app.stage.removeChild(nodeView);
        });
        this.currentNodeViews.clear();

        this.futureNodeViews.forEach((nodeView) => {
            if (this.app.stage.contains(nodeView)) {
                this.app.stage.removeChild(nodeView);
            }
        });
        this.futureNodeViews.clear();

        // 2. 清空app内容（保留app实例）
        this.app.stage.removeChildren();

        // 3. 清空edgeGraphics
        this.edgeGraphics.clear();
    }

    // === 连线管理 ===
    // createEdge(pId, cId) {
    //     const key = `${pId}_${cId}`;
    //     const g = new Graphics();
    //     this.edgeViews.set(key, g);
    //     this.app.stage.addChildAt(g, 0); // 连线永远在节点下面
    // }

    // removeEdge(pId, cId) {
    //     const key = `${pId}_${cId}`;
    //     const g = this.edgeViews.get(key);
    //     if (g) {
    //         this.edgeViews.delete(key);
    //         this.app.stage.removeChild(g);
    //     }
    // }
}
