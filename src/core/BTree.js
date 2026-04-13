import { BTreeNode } from "./BTreeNode.js";

export class BTree {
    constructor(order = 3) {
        this.order = order;
        this.keyMax = order - 1;
        this.maxChildren = order;
        this.minChildren = Math.floor(this.keyMax / 2) + 1;
        this.minKeys = this.minChildren - 1;

        this.root = null;
        this.commandQueue = []; // 核心：指令录制队列
    }

    // 内部方法：向队列中推入指令
    _emitCmd(type, payload) {
        this.commandQueue.push({ type, payload });
    }

    // 对外暴露的重置方法
    _clearCmds() {
        this.commandQueue = [];
    }

    // -------------------------------------------------------
    // 搜索 (不产生指令)
    // -------------------------------------------------------
    search(key, activeNode = null) {
        if (activeNode === null) activeNode = this.root;
        if (!activeNode) return null;
        if (activeNode.keys.includes(key)) return activeNode;
        if (activeNode.leaf) return null;

        let i = 0;
        while (i < activeNode.keys.length && key > activeNode.keys[i]) i++;
        return this.search(key, activeNode.children[i]);
    }

    // -------------------------------------------------------
    // 插入 (返回指令队列)
    // -------------------------------------------------------
    insert(key) {
        this._clearCmds(); // 每次新操作前清空队列

        if (this.root === null) {
            this.root = new BTreeNode(true, this.order);
            this.root.tree = this;
        }
        if (this.search(key)) return this.commandQueue; // 重复值不操作，返回空队列

        const result = this.root.insertNode(key);
        if (result !== null) {
            this._changeRoot(result[0], result[1]);
        }
        if (this.root.children.length === 0) {
            this.root.leaf = true;
        }

        return this.commandQueue; // 返回录制好的脚本
    }

    _changeRoot(newNode, value) {
        const oldNode = this.root;
        this.root = new BTreeNode(false, this.order);
        this.root.tree = this;

        this.root.keys.push(value);
        this.root.children.push(oldNode);
        this.root.children.push(newNode);
        this.root.parent = null;

        for (const child of this.root.children) {
            child.parent = this.root;
        }

        // [指令] 树长高，生成新根
        this._emitCmd("NEW_ROOT", {
            oldRootId: oldNode.id,
            newRootId: this.root.id,
            key: value,
        });
    }

    // -------------------------------------------------------
    // 删除 (返回指令队列)
    // -------------------------------------------------------
    delete(key) {
        this._clearCmds();
        const node = this.search(key, this.root);
        if (node === null) return this.commandQueue;

        if (node.leaf) {
            const idx = node.keys.indexOf(key);
            // [指令] 从叶子节点移除 key
            this._emitCmd("REMOVE_KEY", { nodeId: node.id, key });
            node.keys.splice(idx, 1);

            if (node.keys.length < this.minKeys) {
                // [指令] 节点下溢
                this._emitCmd("UNDERFLOW", { nodeId: node.id });
                this._handleUnderflow(node);
            }
        } else {
            this._deleteNotLeafNode(node, key);
        }

        if (!this.root.keys.length && this.root.children.length) {
            // [指令] 根节点降级
            this._emitCmd("ROOT_DEMOTION", {
                oldRootId: this.root.id,
                newRootId: this.root.children[0].id,
            });
            this.root = this.root.children[0];
            this.root.parent = null;
        }

        return this.commandQueue;
    }

    _deleteNotLeafNode(node, key) {
        const indexOfKeyInNode = node.keys.indexOf(key);
        const leftChild = node.children[indexOfKeyInNode];
        const rightChild = node.children[indexOfKeyInNode + 1];

        const isLeftHeavy = leftChild.keys.length > this.minKeys;
        const isRightHeavy = rightChild.keys.length > this.minKeys;

        if (isLeftHeavy || isRightHeavy) {
            const sourceChild = isLeftHeavy ? leftChild : rightChild;
            const isPredecessor = isLeftHeavy;

            let leafNode = sourceChild;
            while (!leafNode.leaf) {
                leafNode = isPredecessor
                    ? leafNode.children[leafNode.children.length - 1]
                    : leafNode.children[0];
            }

            const leafKey = isPredecessor
                ? leafNode.keys[leafNode.keys.length - 1]
                : leafNode.keys[0];

            // [指令] 前驱/后继 key 飞过来替换
            this._emitCmd("REPLACE_KEY", {
                targetNodeId: node.id,
                oldKey: key,
                newKey: leafKey,
                sourceNodeId: leafNode.id,
            });

            node.keys[indexOfKeyInNode] = leafKey;
            isPredecessor ? leafNode.keys.pop() : leafNode.keys.shift();

            if (leafNode.keys.length < this.minKeys) {
                this._emitCmd("UNDERFLOW", { nodeId: leafNode.id });
                this._handleUnderflow(leafNode);
            }
        } else {
            // 强行合并
            this._exchangeAndMerge(node, indexOfKeyInNode, leftChild, true);
        }
    }

    _exchangeAndMerge(targetNode, indexOfKey, leftChild, isPredecessor) {
        let leafNode = leftChild;
        while (!leafNode.leaf) {
            leafNode = leafNode.children[leafNode.children.length - 1];
        }
        const leafKey = leafNode.keys[leafNode.keys.length - 1];

        this._emitCmd("REPLACE_KEY", {
            targetNodeId: targetNode.id,
            oldKey: targetNode.keys[indexOfKey],
            newKey: leafKey,
            sourceNodeId: leafNode.id,
        });
        targetNode.keys[indexOfKey] = leafKey;
        leafNode.keys.pop();

        this._emitCmd("UNDERFLOW", { nodeId: leafNode.id });
        this._handleUnderflow(leafNode);
    }

    // -------------------------------------------------------
    // 下溢处理 (极度复杂，产生大量指令)
    // -------------------------------------------------------
    _handleUnderflow(node) {
        const parent = node.parent;
        if (!parent) return;

        const indexOfNodeInParent = parent.children.indexOf(node);
        const leftBroNode =
            indexOfNodeInParent > 0 ? parent.children[indexOfNodeInParent - 1] : null;
        const rightBroNode =
            indexOfNodeInParent < parent.children.length - 1
                ? parent.children[indexOfNodeInParent + 1]
                : null;

        // 1. 从左兄弟借
        if (leftBroNode && leftBroNode.keys.length > this.minKeys) {
            const parentKey = parent.keys[indexOfNodeInParent - 1];
            const broKey = leftBroNode.keys.pop();

            // [指令] 借键：父键下移，兄弟键上移
            this._emitCmd("BORROW_FROM_LEFT", {
                parentId: parent.id,
                nodeId: node.id,
                leftBroId: leftBroNode.id,
                parentKey,
                broKey,
            });

            node.keys.unshift(parentKey);
            parent.keys[indexOfNodeInParent - 1] = broKey;

            if (leftBroNode.children.length) {
                const adoptedChild = leftBroNode.children.pop();
                adoptedChild.parent = node;
                node.children.unshift(adoptedChild);
            }
            return;
        }

        // 2. 从右兄弟借
        if (rightBroNode && rightBroNode.keys.length > this.minKeys) {
            const parentKey = parent.keys[indexOfNodeInParent];
            const broKey = rightBroNode.keys.shift();

            // [指令] 借键：父键下移，兄弟键上移
            this._emitCmd("BORROW_FROM_RIGHT", {
                parentId: parent.id,
                nodeId: node.id,
                rightBroId: rightBroNode.id,
                parentKey,
                broKey,
            });

            node.keys.push(parentKey);
            parent.keys[indexOfNodeInParent] = broKey;

            if (rightBroNode.children.length) {
                const adoptedChild = rightBroNode.children.shift();
                adoptedChild.parent = node;
                node.children.push(adoptedChild);
            }
            return;
        }

        // 3. 合并
        if (leftBroNode) {
            const parentKey = parent.keys[indexOfNodeInParent - 1];

            // [指令] 与左兄弟合并，左兄弟吸收当前节点
            this._emitCmd("MERGE_WITH_LEFT", {
                parentId: parent.id,
                keepNodeId: leftBroNode.id,
                absorbNodeId: node.id,
                parentKey,
            });

            leftBroNode.keys.push(parentKey);
            leftBroNode.keys.push(...node.keys);
            parent.keys.splice(indexOfNodeInParent - 1, 1);

            for (const child of node.children) child.parent = leftBroNode;
            leftBroNode.children.push(...node.children);
            parent.children.splice(indexOfNodeInParent, 1);
        } else if (rightBroNode) {
            const parentKey = parent.keys[indexOfNodeInParent];

            // [指令] 与右兄弟合并，当前节点吸收右兄弟
            this._emitCmd("MERGE_WITH_RIGHT", {
                parentId: parent.id,
                keepNodeId: node.id,
                absorbNodeId: rightBroNode.id,
                parentKey,
            });

            node.keys.push(parentKey);
            node.keys.push(...rightBroNode.keys);
            parent.keys.splice(indexOfNodeInParent, 1);

            for (const child of rightBroNode.children) child.parent = node;
            node.children.push(...rightBroNode.children);
            parent.children.splice(indexOfNodeInParent + 1, 1);
        }

        // 递归检查父节点
        if (parent.keys.length < this.minKeys) {
            this._emitCmd("UNDERFLOW", { nodeId: parent.id });
            this._handleUnderflow(parent);
        }
    }

    traverseNode() {
        // 遍历树节点, 输出节点列表
        const result = [];

        const preorderTraverse = (node) => {
            if (!node) return;

            result.push(node);

            if (!node.leaf) {
                for (const child of node.children) {
                    preorderTraverse(child);
                }
            }
        };

        preorderTraverse(this.root);
        return result;
    }
}
