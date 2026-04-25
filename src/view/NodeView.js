import { NODE_CONFIG } from "../config.js";
import { Container, Graphics, Text, TextStyle } from "pixi.js";

export class NodeView extends Container {
    /**
     * 构造函数
     * @param {number[]} ViewKeyValues - 数字键值数组（必传）
     * @param {NodeView|null} parent - 父节点引用（可选，默认null）
     */
    constructor(ViewKeyValues, dataNodeId) {
        super();
        // 数据结构属性初始化
        this.dataNodeId = dataNodeId; // 数据节点ID
        this.id = dataNodeId; // 节点ID（与数据节点ID一致）
        this.ViewKeyValues = [...ViewKeyValues]; // 键值数组（复制）
        this.keyCount = ViewKeyValues.length; // 键值个数（正方形数量）
        this.isHover = false; // 是否hover状态
        this.isActive = false; // 是否当前操作节点

        // 视觉相关配置挂载（便于实例级自定义）
        this.config = { ...NODE_CONFIG };

        // 创建TextStyle实例（只创建一次，复用）
        this.textStyle = new TextStyle({
            fontFamily: "Arial",
            fontSize: this.config.fontSize,
            fontWeight: "bold",
            fill: this.config.borderColor,
            align: "center",
        });

        // 初始化渲染节点
        this.renderNodes();

        // 设置整个节点的锚点为中心（便于定位/连线）
        this.pivot.set((this.config.squareSize * this.keyCount) / 2, this.config.squareSize / 2);

        // 添加交互能力
        this.eventMode = "static";

        // 鼠标hover事件
        this.on("pointerover", () => {
            this.hover(true);
        });

        // 鼠标离开事件
        this.on("pointerout", () => {
            this.hover(false);
        });
    }

    renderNodes(alpha = 1, aimIndex = -1) {
        //方便动画时设置透明度
        // 清空现有子元素（避免重复渲染）
        this.removeChildren();
        this.alpha = alpha;

        if (this.isActive) {
            this.config.fillColor = NODE_CONFIG.activeFillColor;
            this.config.borderColor = NODE_CONFIG.activeBorderColor;
        } else if (this.isHover) {
            this.config.fillColor = NODE_CONFIG.hoverFillColor;
            this.config.borderColor = NODE_CONFIG.hoverBorderColor;
        } else {
            this.config.fillColor = NODE_CONFIG.fillColor;
            this.config.borderColor = NODE_CONFIG.borderColor;
        }

        // 更新TextStyle的颜色（因为hover时颜色会变化）
        this.textStyle.fill = this.config.borderColor;
        // 应用TextStyle的更改
        this.textStyle.update();

        // 遍历键值，逐个绘制正方形和文字
        this.ViewKeyValues.forEach((key, index) => {
            // 1. 创建单个正方形
            const square = new Graphics();
            // 计算当前正方形的x坐标（无间距横向排列）
            const x = index * this.config.squareSize;
            if (index === aimIndex) {
                square.alpha = 0;
            }
            // 绘制正方形（填充 + 边框）
            square
                .rect(x, 0, this.config.squareSize, this.config.squareSize)
                .fill(this.config.fillColor)
                .stroke({
                    width: this.config.borderWidth,
                    color: this.config.borderColor,
                });

            this.addChild(square);

            // 2. 创建数字键值文本（复用TextStyle）
            const keyText = new Text({ text: key.toString(), style: this.textStyle });
            // 文本居中（相对于当前正方形）
            keyText.anchor.set(0.5);
            keyText.x = x + this.config.squareSize / 2;
            keyText.y = this.config.squareSize / 2;
            if (index === aimIndex) {
                keyText.alpha = 0;
            }
            this.addChild(keyText);
        });
        // console.log(this.x, this.y);
        // console.log(this.children);
    }

    setPivot() {
        this.pivot.set((this.config.squareSize * this.keyCount) / 2, this.config.squareSize / 2);
    }

    updateKeysAndRender(newKeys) {
        this.ViewKeyValues = [...newKeys];
        this.keyCount = this.ViewKeyValues.length;
        this.setPivot();
        this.renderNodes();
    }

    addKeyandRender(key, index) {
        this.ViewKeyValues.splice(index, 0, key);
        this.keyCount = this.ViewKeyValues.length;
        this.setPivot();
        this.renderNodes();
    }

    getLefttop() {
        return { x: this.x - this.pivot.x, y: this.y - this.pivot.y };
    }

    getTopCenter() {
        return { x: this.x, y: this.y - this.config.squareSize / 2 };
    }

    getSlotAnchor(slotIndex) {
        const height = this.config.squareSize;
        const anchorX = this.x + (slotIndex - this.keyCount / 2) * this.config.squareSize;
        const anchorY = this.y + height / 2;
        return { x: anchorX, y: anchorY };
    }

    getKeyItem(index) {
        return { square: this.children[index * 2], text: this.children[index * 2 + 1] };
    }

    /**
     * 处理hover状态的颜色切换
     * @param {boolean} isHover - 是否处于hover状态
     */
    hover(isHover) {
        // 切换配色方案
        this.isHover = isHover;
        // 重新渲染节点
        this.renderNodes();
    }
}
