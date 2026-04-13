// 假设 NODE_CONFIG 已经在外部定义
import { NODE_CONFIG } from "../config.js";

class LayoutEngine {
    constructor(config = NODE_CONFIG) {
        this.squareSize = config.squareSize;
        // 定义节点之间的间距
        this.HORIZONTAL_GAP = this.squareSize * 0.8; // 同层节点水平间距
        this.VERTICAL_GAP = this.squareSize * 1.8; // 父子节点垂直间距
    }

    /**
     * 计算布局入口
     * @param {BTree} tree - B树实例
     * @returns {Object} finalPositions - 格式: { 'node-1': {x: 100, y: 200}, ... } (坐标为中心点)
     */
    calculate(tree) {
        if (!tree || !tree.root) return {};

        const root = tree.root;

        // ==========================
        // 第一遍扫描：自底向上计算子树宽度（以左上角到右上角的距离为准）
        // ==========================
        this._calcSubtreeWidth(root);

        // ==========================
        // 第二遍扫描：自顶向下计算【相对中心坐标】（以根节点中心为 0,0 起算）
        // ==========================
        this._assignRelativeCenterPos(root, 0, 0);

        // ==========================
        // 第三步：将相对中心坐标转换为 Pixi 绝对中心坐标
        // ==========================
        const finalPositions = {};

        // 核心约束：根节点中心在画布的绝对坐标锚点
        const ROOT_ANCHOR_X = 10 * this.squareSize;
        const ROOT_ANCHOR_Y = 2 * this.squareSize;

        const transformToPixi = (node) => {
            // 因为根节点的相对中心是 (0,0)，所以直接加上锚点偏移即可
            // 其他节点根据与根节点的相对偏移量自动平移
            finalPositions[node.id] = {
                x: node._relCenterX + ROOT_ANCHOR_X,
                y: node._relCenterY + ROOT_ANCHOR_Y,
            };

            if (!node.leaf && node.children.length > 0) {
                node.children.forEach((child) => transformToPixi(child));
            }
        };
        transformToPixi(root);

        // 清理挂在节点上的临时计算属性
        this._cleanTempProps(root);

        return finalPositions;
    }

    /**
     * 内部方法：递归计算节点及其所有子树所需的水平总宽度
     */
    _calcSubtreeWidth(node) {
        // 节点自身物理宽度
        const nodeWidth = Math.max(node.keys.length, 1) * this.squareSize;

        if (node.leaf || node.children.length === 0) {
            node._subtreeWidth = nodeWidth;
            return node._subtreeWidth;
        }

        let childrenTotalWidth = 0;
        node.children.forEach((child, index) => {
            childrenTotalWidth += this._calcSubtreeWidth(child);
            if (index < node.children.length - 1) {
                childrenTotalWidth += this.HORIZONTAL_GAP;
            }
        });

        // 取自身宽度和子树总宽度的最大值，防止父节点过宽导致子节点溢出
        node._subtreeWidth = Math.max(nodeWidth, childrenTotalWidth);
        return node._subtreeWidth;
    }

    /**
     * 内部方法：递归分配【相对中心坐标】
     * @param {BTreeNode} node - 当前节点
     * @param {number} centerX - 当前节点中心的相对 X 坐标
     * @param {number} centerY - 当前节点中心的相对 Y 坐标
     */
    _assignRelativeCenterPos(node, centerX, centerY) {
        // 锁定当前节点的中心坐标
        node._relCenterX = centerX;
        node._relCenterY = centerY;

        if (!node.leaf && node.children.length > 0) {
            // 1. 算出所有子节点整体占用的总宽度
            let childrenTotalWidth = 0;
            node.children.forEach((child, index) => {
                childrenTotalWidth += child._subtreeWidth;
                if (index < node.children.length - 1) {
                    childrenTotalWidth += this.HORIZONTAL_GAP;
                }
            });

            // 2. 计算第一个子节点的中心 X
            // 起点偏移 = (父节点子树总宽 - 子节点们总宽) / 2
            // 第一个子节点中心 = 父节点中心X + 起点偏移 + 第一个子节点自身宽度的一半
            let currentChildCenterX =
                centerX - childrenTotalWidth / 2 + node.children[0]._subtreeWidth / 2;

            // Y 坐标统一向下移动一个垂直间距
            let childCenterY = centerY + this.VERTICAL_GAP;

            // 3. 遍历子节点，计算后续子节点的中心 X
            node.children.forEach((child, index) => {
                if (index > 0) {
                    // 后续子节点中心 = 上一个子节点中心 + 上一个子节点半宽 + 间距 + 当前子节点半宽
                    const prevChild = node.children[index - 1];
                    currentChildCenterX =
                        prevChild._relCenterX +
                        prevChild._subtreeWidth / 2 +
                        this.HORIZONTAL_GAP +
                        child._subtreeWidth / 2;
                }

                // 递归赋值
                this._assignRelativeCenterPos(child, currentChildCenterX, childCenterY);
            });
        }
    }

    /**
     * 内部方法：清除临时属性
     */
    _cleanTempProps(node) {
        delete node._subtreeWidth;
        delete node._relCenterX;
        delete node._relCenterY;

        if (!node.leaf && node.children.length > 0) {
            node.children.forEach((child) => this._cleanTempProps(child));
        }
    }
}

// 导出实例
export const layoutEngine = new LayoutEngine();
