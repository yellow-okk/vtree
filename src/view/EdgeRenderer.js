import { Graphics } from "pixi.js";

export function renderTreeEdge(tree, nodeViewMap, edgeGraphics, edgeStyle) {
    edgeGraphics.clear();

    if (!tree.root) {
        console.error("tree.root is null");
        return;
    }
    const drawEdgesRecursive = (dataNode) => {
        if (dataNode.leaf || dataNode.children.length === 0) return;

        // 1. 从视图字典中找到父节点的视图
        const parentView = nodeViewMap.get(dataNode.id);
        if (!parentView) return;

        // 2. 遍历数据节点的 children 数组（这就是天然的插槽索引！）
        dataNode.children.forEach((childDataNode, slotIndex) => {
            // 从视图字典中找到子节点的视图
            const childView = nodeViewMap.get(childDataNode.id);
            if (!childView) return;

            // 3. 拿着 slotIndex，去问父视图要出发坐标
            const startPos = parentView.getSlotAnchor(slotIndex);

            // 4. 问子视图要到达坐标
            const endPos = childView.getTopCenter();

            // 5. 画贝塞尔曲线
            const controlY = (startPos.y + endPos.y) / 2;
            edgeGraphics.moveTo(startPos.x, startPos.y);
            edgeGraphics
                .quadraticCurveTo(startPos.x, controlY, endPos.x, endPos.y)
                .stroke(edgeStyle);

            // 6. 递归往下画
            drawEdgesRecursive(childDataNode);
        });
    };

    drawEdgesRecursive(tree.root);
}
