let _nodeIdCounter = 0;

export class BTreeNode {
    constructor(leaf = false, order = 3) {
        this.id = `node-${_nodeIdCounter++}`;
        this.leaf = leaf;
        this.order = order;
        this.keys = [];
        this.keyMax = order - 1;
        this.children = [];
        this.parent = null;

        // 引用所属的 BTree 实例，以便节点能够发射指令
        this.tree = null;
    }

    insertNode(key) {
        let i = 0;
        while (i < this.keys.length && key > this.keys[i]) {
            i++;
        }

        if (this.leaf) {
            this.keys.splice(i, 0, key);
            // [指令] 向当前节点插入 key
            this.tree._emitCmd("INSERT_KEY", { nodeId: this.id, key, index: i });

            if (this.keys.length > this.keyMax) {
                // [指令] 当前节点溢出
                this.tree._emitCmd("OVERFLOW", { nodeId: this.id });
                return this.split();
            }
        } else {
            const res = this.children[i].insertNode(key);

            if (res !== null) {
                const [newNode, midKey] = res;

                // [指令] 中间 key 飞向当前父节点
                this.tree._emitCmd("PUSH_UP_KEY", {
                    key: midKey,
                    fromNodeId: this.children[i].id,
                    toNodeId: this.id,
                });

                this.keys.splice(i, 0, midKey);
                this.children.splice(i + 1, 0, newNode);
                newNode.parent = this;

                // [指令] 父节点视觉上接收了 key
                this.tree._emitCmd("INSERT_KEY", { nodeId: this.id, key: midKey, index: i });

                if (this.keys.length > this.keyMax) {
                    // [指令] 父节点溢出
                    this.tree._emitCmd("OVERFLOW", { nodeId: this.id });
                    return this.split();
                }
            }
        }
        return null;
    }

    split() {
        const newNode = new BTreeNode(this.leaf, this.order);
        newNode.parent = this.parent;
        newNode.tree = this.tree;

        const midIdx = Math.floor(this.keyMax / 2);
        const keyMedian = this.keys[midIdx];

        // 保存分裂后的状态供指令使用
        const leftKeys = this.keys.slice(0, midIdx);
        const rightKeys = this.keys.slice(midIdx + 1);

        // [指令] 准备分裂（携带分裂后的两边 key 状态）
        this.tree._emitCmd("SPLIT_PREPARE", {
            oldNodeId: this.id,
            newNodeId: newNode.id,
            leftKeys,
            rightKeys,
        });

        // 执行真正的数据切割
        newNode.keys = rightKeys;
        this.keys = leftKeys;

        if (!this.leaf) {
            const rightChildren = this.children.slice(midIdx + 1);
            const leftChildren = this.children.slice(0, midIdx + 1);

            newNode.children = rightChildren;
            this.children = leftChildren;

            for (const child of newNode.children) {
                child.parent = newNode;
            }
        }

        return [newNode, keyMedian];
    }
}
