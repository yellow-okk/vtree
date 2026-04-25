import { CommandTypes } from "../commands/CommandTypes.js";
import { NODE_CONFIG } from "../config.js";

import { gsap } from "gsap";
import { PixiPlugin } from "gsap/PixiPlugin";
import * as PIXI from "pixi.js";
gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI(PIXI);

export class AnimationPlayer {
    constructor(viewManager) {
        this.viewManager = viewManager;
        this.commandQueue = [];
        this.isPlaying = false;
        this.standardDuration = 1500;
        this.createRoot = false;
        this.tickerCallback = null;
        this.playTimeline = null;
    }

    /**
     * 向命令队列添加命令
     * @param {Object} command 命令对象
     */
    addCommand(command) {
        console.log("添加命令:", command);
        this.commandQueue.push(command);
    }

    /**
     * 从命令队列中取出命令
     * @returns {Object|null} 取出的命令对象，如果队列为空则返回null
     */
    dequeueCommand() {
        if (this.commandQueue.length === 0) {
            return null;
        }
        return this.commandQueue.shift();
    }

    /**
     * 处理命令
     * @param {Object} command 命令对象
     */
    processCommand(command, positions) {
        if (!command || !command.type) {
            return;
        }

        switch (command.type) {
            case CommandTypes.CREATE_ROOT:
                this.handleCreateRoot(command);
                break;
            case CommandTypes.INSERT_KEY:
                this.handleInsertKey(command, positions);
                break;
            case CommandTypes.REMOVE_KEY:
                this.handleRemoveKey(command, positions);
                break;
            case CommandTypes.REPLACE_KEY:
                this.handleReplaceKey(command, positions);
                break;
            case CommandTypes.OVERFLOW:
                this.handleOverflow(command, positions);
                break;
            case CommandTypes.UNDERFLOW:
                this.handleUnderflow(command, positions);
                break;
            case CommandTypes.SPLIT_PREPARE:
                this.handleSplitPrepare(command, positions);
                break;
            case CommandTypes.PUSH_UP_KEY:
                this.handlePushUpKey(command, positions);
                break;
            case CommandTypes.NEW_ROOT:
                this.handleNewRoot(command, positions);
                break;
            case CommandTypes.ROOT_DEMOTION:
                this.handleRootDemotion(command, positions);
                break;
            case CommandTypes.BORROW_FROM_LEFT:
                this.handleBorrowFromLeft(command, positions);
                break;
            case CommandTypes.BORROW_FROM_RIGHT:
                this.handleBorrowFromRight(command, positions);
                break;
            case CommandTypes.MERGE_WITH_LEFT:
                this.handleMergeWithLeft(command, positions);
                break;
            case CommandTypes.MERGE_WITH_RIGHT:
                this.handleMergeWithRight(command, positions);
                break;
            default:
                console.warn(`Unknown command type: ${command.type}`);
        }
    }

    /**
     * 开始播放动画
     * @param {Array} commandQueue 命令队列
     * @param {Object} finalPositions 最终位置
     * @param {Object} tree 树结构
     * @param {number} n 延迟倍数
     * @param {Function} onComplete 动画完成回调
     */
    play(commandQueue, finalPositions, tree, n = 0.1, onComplete) {
        if (this.playTimeline) {
            this.playTimeline.kill();
            this.playTimeline = null;
        }
        if (this.tickerCallback) {
            gsap.ticker.remove(this.tickerCallback);
            this.tickerCallback = null;
        }

        this.isPlaying = true;

        // 添加 ticker 回调，实时更新连线
        this.tickerCallback = () => {
            this.viewManager.renderEdgeContinuously(tree);
        };
        gsap.ticker.add(this.tickerCallback);

        let count = 1;
        const interval = Math.max(n * (this.standardDuration / 1000), 0);
        const settleDuration = this.standardDuration / 1000;
        const adjustDuration = this.standardDuration / 2000;

        this.playTimeline = gsap.timeline({
            onComplete: () => {
                if (this.tickerCallback) {
                    gsap.ticker.remove(this.tickerCallback);
                    this.tickerCallback = null;
                }
                this.isPlaying = false;
                this.playTimeline = null;
                if (onComplete) {
                    onComplete();
                }
            },
        });

        if (!commandQueue.length) {
            this.playTimeline.call(() => {
                this.adjustPositions(finalPositions);
            });
            this.playTimeline.to({}, { duration: adjustDuration });
            return;
        }

        for (let i = 0; i < commandQueue.length; i++) {
            const cmd = commandQueue[i];
            this.playTimeline.call(() => {
                this.executeCommand(cmd, finalPositions);
                console.log(`第${count++}条指令:`, cmd.type);
                console.log(this.viewManager.currentNodeViews);
            });

            if (i < commandQueue.length - 1 && interval > 0) {
                this.playTimeline.to({}, { duration: interval });
            }
        }

        // 等最后一条指令自身动画稳定后，再做最终位置收敛
        this.playTimeline
            .to({}, { duration: settleDuration })
            .call(() => {
            this.adjustPositions(finalPositions);
            })
            .to({}, { duration: adjustDuration });
    }

    /**
     * 执行单个命令
     */
    executeCommand(cmd, finalPos) {
        this.processCommand(cmd, finalPos);
        // 移除了异步延迟，改为同步执行
    }

    /**
     * 调整节点位置
     */
    adjustPositions(positions) {
        const nodeViewsMap = this.viewManager.currentNodeViews;
        for (const [nodeId, view] of nodeViewsMap) {
            if (!view.x || !view.y) continue;
            const pos = positions[nodeId];
            gsap.to(view, {
                pixi: { x: pos.x, y: pos.y },
                duration: this.standardDuration / 2000,
            });
            // view.x = pos.x;
            // view.y = pos.y;
            console.log(`调整节点${nodeId}位置到${pos.x}, ${pos.y}`);
        }
    }

    /**
     * 停止播放动画
     */
    stop() {
        if (this.playTimeline) {
            this.playTimeline.kill();
            this.playTimeline = null;
        }
        this.isPlaying = false;
        if (this.tickerCallback) {
            gsap.ticker.remove(this.tickerCallback);
            this.tickerCallback = null;
        }
    }

    /**
     * 清空命令队列
     */
    clearQueue() {
        this.commandQueue = [];
    }

    getNodeKeys(node) {
        return node && Array.isArray(node.ViewKeyValues) ? [...node.ViewKeyValues] : [];
    }

    getKeyIndex(node, key) {
        return this.getNodeKeys(node).indexOf(key);
    }

    getNodeTargetPosition(nodeOrId, positions) {
        if (!positions) return null;

        const nodeId = typeof nodeOrId === "string" ? nodeOrId : nodeOrId?.dataNodeId;
        return nodeId ? positions[nodeId] || null : null;
    }

    getKeyCenterAtPosition(node, index, position = null) {
        if (!node || index < 0) {
            return { x: 0, y: 0 };
        }

        const basePosition = position || { x: node.x, y: node.y };
        const size = node.config.squareSize;
        return {
            x: basePosition.x - node.pivot.x + index * size + size / 2,
            y: basePosition.y - node.pivot.y + size / 2,
        };
    }

    getKeyCenter(node, index) {
        return this.getKeyCenterAtPosition(node, index);
    }

    moveNodeToPosition(node, positions, duration = this.standardDuration / 2000) {
        const targetPos = this.getNodeTargetPosition(node, positions);
        if (!node || !targetPos) return null;

        return gsap.to(node, {
            pixi: { x: targetPos.x, y: targetPos.y },
            duration,
            ease: "power2.inOut",
        });
    }

    addPositionTweens(timeline, nodes, positions, at = 0, duration = this.standardDuration / 2000) {
        if (!timeline || !positions) return;

        for (const node of nodes) {
            const tween = this.moveNodeToPosition(node, positions, duration);
            if (tween) {
                timeline.add(tween, at);
            }
        }
    }

    refreshNodeKeys(node, nextKeys, positions = null) {
        if (!node) return;
        node.updateKeysAndRender(nextKeys);
        this.moveNodeToPosition(node, positions, this.standardDuration / 2200);
        const targets = node.children.filter(Boolean);
        if (!targets.length) return;

        gsap.fromTo(
            targets,
            {
                pixi: { alpha: 0, scaleX: 0.85, scaleY: 0.85 },
            },
            {
                pixi: { alpha: 1, scaleX: 1, scaleY: 1 },
                duration: this.standardDuration / 2500,
                ease: "back.out(1.2)",
                stagger: 0.02,
            },
        );
    }

    createFloatingKeyText(key, startPos) {
        const { Text } = PIXI;
        const text = new Text({
            text: key.toString(),
            style: {
                fontFamily: "Arial",
                fontSize: 18,
                fontWeight: "bold",
                fill: "#6a0dad",
            },
        });
        text.anchor.set(0.5);
        text.position.set(startPos.x, startPos.y);
        this.viewManager.app.stage.addChild(text);
        return text;
    }

    removeFloatingDisplay(displayObject) {
        if (displayObject && displayObject.parent) {
            displayObject.parent.removeChild(displayObject);
        }
        displayObject?.destroy?.();
    }

    // 以下是具体命令的处理方法，暂时只定义方法框架
    handleCreateRoot(command) {
        this.createRoot = true;
    }
    handleInsertKey(command, positions) {
        let pos = positions[command.payload.nodeId];
        const currentNode = this.viewManager.currentNodeViews.get(command.payload.nodeId);

        if (this.createRoot) {
            const newNode = this.viewManager.createNodeView(
                [command.payload.key],
                command.payload.nodeId,
                pos.x,
                pos.y,
            );
            newNode.alpha = 0;
            newNode.scale.set(0);
            gsap.to(newNode, {
                pixi: { alpha: 1, scaleX: 1, scaleY: 1 },

                duration: this.standardDuration / 1000,
                ease: "back.out",
            });
            this.createRoot = false;
        } else {
            currentNode.addKeyandRender(command.payload.key, command.payload.index);
            const newItem = currentNode.getKeyItem(command.payload.index);

            gsap.from([newItem.square, newItem.text], {
                pixi: { alpha: 0, scaleX: 0, scaleY: 0 },
                duration: this.standardDuration / 2000,
                ease: "back.out",
            });

            for (let i = 0; i < currentNode.keyCount; i++) {
                if (i !== command.payload.index) {
                    const item = currentNode.getKeyItem(i);
                    gsap.to([item.square, item.text], {
                        pixi: { alpha: 1 },
                        duration: this.standardDuration / 2000,
                    });
                }
            }
        }
    }

    handleRemoveKey(command, positions) {
        const node = this.viewManager.currentNodeViews.get(command.payload.nodeId);
        if (!node) return;

        const currentKeys = this.getNodeKeys(node);
        const keyIndex = currentKeys.indexOf(command.payload.key);
        if (keyIndex === -1) return;

        const item = node.getKeyItem(keyIndex);
        const nextKeys = [...currentKeys];
        nextKeys.splice(keyIndex, 1);

        this.moveNodeToPosition(node, positions, this.standardDuration / 2200);

        gsap.to([item.square, item.text], {
            pixi: { alpha: 0, scaleX: 0, scaleY: 0, y: "-=16" },
            duration: this.standardDuration / 2200,
            ease: "power2.in",
            onComplete: () => {
                this.refreshNodeKeys(node, nextKeys, positions);
            },
        });
    }

    handleReplaceKey(command, positions) {
        const targetNode = this.viewManager.currentNodeViews.get(command.payload.targetNodeId);
        const sourceNode = this.viewManager.currentNodeViews.get(command.payload.sourceNodeId);
        if (!targetNode || !sourceNode) return;

        const targetKeys = this.getNodeKeys(targetNode);
        const sourceKeys = this.getNodeKeys(sourceNode);
        const oldKeyIndex = targetKeys.indexOf(command.payload.oldKey);
        const sourceKeyIndex = sourceKeys.indexOf(command.payload.newKey);

        if (oldKeyIndex === -1 || sourceKeyIndex === -1) return;

        const targetItem = targetNode.getKeyItem(oldKeyIndex);
        const sourceItem = sourceNode.getKeyItem(sourceKeyIndex);
        const floatingKey = this.createFloatingKeyText(
            command.payload.newKey,
            this.getKeyCenter(sourceNode, sourceKeyIndex),
        );

        const nextTargetKeys = [...targetKeys];
        nextTargetKeys[oldKeyIndex] = command.payload.newKey;

        const nextSourceKeys = [...sourceKeys];
        nextSourceKeys.splice(sourceKeyIndex, 1);

        const targetEndCenter = this.getKeyCenterAtPosition(
            targetNode,
            oldKeyIndex,
            this.getNodeTargetPosition(targetNode, positions),
        );

        const tl = gsap.timeline({
            onComplete: () => {
                this.removeFloatingDisplay(floatingKey);
                this.refreshNodeKeys(targetNode, nextTargetKeys, positions);
                this.refreshNodeKeys(sourceNode, nextSourceKeys, positions);
            },
        });

        this.addPositionTweens(
            tl,
            [targetNode, sourceNode],
            positions,
            0,
            this.standardDuration / 1800,
        );

        tl.to(
            targetItem ? [targetItem.square, targetItem.text] : [],
            {
                pixi: { alpha: 0.2 },
                duration: this.standardDuration / 3000,
                ease: "power1.out",
            },
            0,
        )
            .to(
                sourceItem ? [sourceItem.square, sourceItem.text] : [],
                {
                    pixi: { alpha: 0.2 },
                    duration: this.standardDuration / 3000,
                    ease: "power1.out",
                },
                0,
            )
            .to(
                floatingKey,
                {
                    pixi: {
                        x: targetEndCenter.x,
                        y: targetEndCenter.y,
                    },
                    duration: this.standardDuration / 1800,
                    ease: "power2.inOut",
                },
                0.05,
            );
    }

    handleOverflow(command) {
        const node = this.viewManager.currentNodeViews.get(command.payload.nodeId);
        if (!node) return;

        gsap.to(node, {
            pixi: { scaleX: 1.1, scaleY: 1.1 },
            duration: this.standardDuration / 4000,
            repeat: 1,
            yoyo: true,
            ease: "power2.inOut",
        });
    }

    handleUnderflow(command, positions) {
        const node = this.viewManager.currentNodeViews.get(command.payload.nodeId);
        if (!node) return;

        const tl = gsap.timeline();
        this.addPositionTweens(tl, [node], positions, 0, this.standardDuration / 1800);
        tl.to(node.scale, {
            x: 1.08,
            y: 1.08,
            duration: this.standardDuration / 6000,
            repeat: 3,
            yoyo: true,
            ease: "power2.inOut",
        });
    }

    handleSplitPrepare(command, positions) {
        const oldNode = this.viewManager.currentNodeViews.get(command.payload.oldNodeId);
        const newNode = this.viewManager.createNodeView(
            command.payload.rightKeys,
            command.payload.newNodeId,
            oldNode.x,
            oldNode.y,
        );

        newNode.alpha = 0;
        newNode.scale.set(0.5);

        oldNode.updateKeysAndRender(command.payload.leftKeys);

        const oldPos = positions[command.payload.oldNodeId];
        const newPos = positions[command.payload.newNodeId];

        const tl = gsap.timeline();
        tl.to(oldNode, {
            pixi: { x: oldPos.x, y: oldPos.y },
            duration: this.standardDuration / 2000,
            ease: "power2.inOut",
        }).to(
            newNode,
            {
                pixi: { alpha: 1, x: newPos.x, y: newPos.y, scaleX: 1, scaleY: 1 },

                duration: this.standardDuration / 2000,
                ease: "back.out",
            },
            "-=0.15",
        );
    }

    handlePushUpKey(command) {
        console.log(command);

        const parentNode = this.viewManager.currentNodeViews.get(command.payload.toNodeId);
        const childNode = this.viewManager.currentNodeViews.get(command.payload.fromNodeId);
        if (!parentNode || !childNode) return;

        const { Text, Graphics } = PIXI;
        const tempText = new Text({
            text: command.payload.key.toString(),
            style: {
                fontFamily: "Arial",
                fontSize: 18,
                fontWeight: "bold",
                fill: "#6a0dad",
            },
        });
        tempText.anchor.set(0.5);

        const startPos = { x: childNode.x, y: childNode.y - 30 };
        const endPos = { x: parentNode.x, y: parentNode.y + 30 };
        console.log(startPos, endPos);

        tempText.position.set(startPos.x, startPos.y);
        this.viewManager.app.stage.addChild(tempText);

        gsap.to(tempText, {
            pixi: { x: endPos.x, y: endPos.y, alpha: 1 },
            duration: this.standardDuration / 2000,
            ease: "power2.inOut",
            onComplete: () => {
                this.viewManager.app.stage.removeChild(tempText);
            },
        });
    }

    handleNewRoot(command, positions) {
        const oldRoot = this.viewManager.currentNodeViews.get(command.payload.oldRootId);
        const newRoot = this.viewManager.createNodeView(
            [command.payload.key],
            command.payload.newRootId,
            oldRoot.x,
            oldRoot.y,
        );

        newRoot.alpha = 0;
        newRoot.scale.set(0);

        const newPos = positions[command.payload.newRootId];
        const oldRootNewPos = positions[command.payload.oldRootId];

        const tl = gsap.timeline();
        tl.to(newRoot, {
            pixi: { alpha: 1, scaleX: 1, scaleY: 1 },

            duration: this.standardDuration / 2000,
            ease: "back.out",
        }).to(
            oldRoot,
            {
                pixi: { x: oldRootNewPos.x, y: oldRootNewPos.y },
                duration: this.standardDuration / 2000,
                ease: "power2.inOut",
            },
            "-=0.2",
        );
    }

    handleRootDemotion(command, positions) {
        const oldRoot = this.viewManager.currentNodeViews.get(command.payload.oldRootId);
        const newRoot = this.viewManager.currentNodeViews.get(command.payload.newRootId);
        if (!oldRoot || !newRoot) return;

        const tl = gsap.timeline();
        this.addPositionTweens(tl, [newRoot], positions, 0, this.standardDuration / 1800);
        tl.to(oldRoot, {
            pixi: { alpha: 0, scaleX: 0.5, scaleY: 0.5 },
            duration: this.standardDuration / 2000,
            ease: "power2.in",
        }).to(
            newRoot,
            {
                pixi: { alpha: 1 },
                duration: this.standardDuration / 2000,
                ease: "power2.out",
            },
            "-=0.15",
        ).call(() => {
            this.viewManager.removeNodeView(command.payload.oldRootId);
        });
    }

    handleBorrowFromLeft(command, positions) {
        const parentNode = this.viewManager.currentNodeViews.get(command.payload.parentId);
        const node = this.viewManager.currentNodeViews.get(command.payload.nodeId);
        const leftBro = this.viewManager.currentNodeViews.get(command.payload.leftBroId);
        if (!parentNode || !node || !leftBro) return;

        const parentKeys = this.getNodeKeys(parentNode);
        const nodeKeys = this.getNodeKeys(node);
        const leftKeys = this.getNodeKeys(leftBro);
        const parentKeyIndex = parentKeys.indexOf(command.payload.parentKey);
        const broKeyIndex = leftKeys.indexOf(command.payload.broKey);
        if (parentKeyIndex === -1 || broKeyIndex === -1) return;

        const parentKeyText = this.createFloatingKeyText(
            command.payload.parentKey,
            this.getKeyCenter(parentNode, parentKeyIndex),
        );
        const broKeyText = this.createFloatingKeyText(
            command.payload.broKey,
            this.getKeyCenter(leftBro, broKeyIndex),
        );

        const nextNodeKeys = [command.payload.parentKey, ...nodeKeys];
        const nextParentKeys = [...parentKeys];
        nextParentKeys[parentKeyIndex] = command.payload.broKey;
        const nextLeftKeys = [...leftKeys];
        nextLeftKeys.pop();
        const nodeKeyCenter = this.getKeyCenterAtPosition(
            node,
            0,
            this.getNodeTargetPosition(node, positions),
        );
        const parentKeyCenter = this.getKeyCenterAtPosition(
            parentNode,
            parentKeyIndex,
            this.getNodeTargetPosition(parentNode, positions),
        );

        const tl = gsap.timeline({
            onComplete: () => {
                this.removeFloatingDisplay(parentKeyText);
                this.removeFloatingDisplay(broKeyText);
                this.refreshNodeKeys(node, nextNodeKeys, positions);
                this.refreshNodeKeys(parentNode, nextParentKeys, positions);
                this.refreshNodeKeys(leftBro, nextLeftKeys, positions);
            },
        });

        this.addPositionTweens(
            tl,
            [node, parentNode, leftBro],
            positions,
            0,
            this.standardDuration / 1800,
        );

        tl.to(parentKeyText, {
            pixi: {
                x: nodeKeyCenter.x,
                y: nodeKeyCenter.y,
            },
            duration: this.standardDuration / 1800,
            ease: "power2.inOut",
        }).to(
            broKeyText,
            {
                pixi: {
                    x: parentKeyCenter.x,
                    y: parentKeyCenter.y,
                },
                duration: this.standardDuration / 1800,
                ease: "power2.inOut",
            },
            0,
        );
    }

    handleBorrowFromRight(command, positions) {
        const parentNode = this.viewManager.currentNodeViews.get(command.payload.parentId);
        const node = this.viewManager.currentNodeViews.get(command.payload.nodeId);
        const rightBro = this.viewManager.currentNodeViews.get(command.payload.rightBroId);
        if (!parentNode || !node || !rightBro) return;

        const parentKeys = this.getNodeKeys(parentNode);
        const nodeKeys = this.getNodeKeys(node);
        const rightKeys = this.getNodeKeys(rightBro);
        const parentKeyIndex = parentKeys.indexOf(command.payload.parentKey);
        const broKeyIndex = rightKeys.indexOf(command.payload.broKey);
        if (parentKeyIndex === -1 || broKeyIndex === -1) return;

        const parentKeyText = this.createFloatingKeyText(
            command.payload.parentKey,
            this.getKeyCenter(parentNode, parentKeyIndex),
        );
        const broKeyText = this.createFloatingKeyText(
            command.payload.broKey,
            this.getKeyCenter(rightBro, broKeyIndex),
        );

        const nextNodeKeys = [...nodeKeys, command.payload.parentKey];
        const nextParentKeys = [...parentKeys];
        nextParentKeys[parentKeyIndex] = command.payload.broKey;
        const nextRightKeys = [...rightKeys];
        nextRightKeys.shift();
        const nodeKeyCenter = this.getKeyCenterAtPosition(
            node,
            nextNodeKeys.length - 1,
            this.getNodeTargetPosition(node, positions),
        );
        const parentKeyCenter = this.getKeyCenterAtPosition(
            parentNode,
            parentKeyIndex,
            this.getNodeTargetPosition(parentNode, positions),
        );

        const tl = gsap.timeline({
            onComplete: () => {
                this.removeFloatingDisplay(parentKeyText);
                this.removeFloatingDisplay(broKeyText);
                this.refreshNodeKeys(node, nextNodeKeys, positions);
                this.refreshNodeKeys(parentNode, nextParentKeys, positions);
                this.refreshNodeKeys(rightBro, nextRightKeys, positions);
            },
        });

        this.addPositionTweens(
            tl,
            [node, parentNode, rightBro],
            positions,
            0,
            this.standardDuration / 1800,
        );

        tl.to(parentKeyText, {
            pixi: {
                x: nodeKeyCenter.x,
                y: nodeKeyCenter.y,
            },
            duration: this.standardDuration / 1800,
            ease: "power2.inOut",
        }).to(
            broKeyText,
            {
                pixi: {
                    x: parentKeyCenter.x,
                    y: parentKeyCenter.y,
                },
                duration: this.standardDuration / 1800,
                ease: "power2.inOut",
            },
            0,
        );
    }

    handleMergeWithLeft(command, positions) {
        const parentNode = this.viewManager.currentNodeViews.get(command.payload.parentId);
        const keepNode = this.viewManager.currentNodeViews.get(command.payload.keepNodeId);
        const absorbNode = this.viewManager.currentNodeViews.get(command.payload.absorbNodeId);
        if (!parentNode || !keepNode || !absorbNode) return;

        const parentKeys = this.getNodeKeys(parentNode);
        const keepKeys = this.getNodeKeys(keepNode);
        const absorbKeys = this.getNodeKeys(absorbNode);
        const parentKeyIndex = parentKeys.indexOf(command.payload.parentKey);
        if (parentKeyIndex === -1) return;

        const parentKeyText = this.createFloatingKeyText(
            command.payload.parentKey,
            this.getKeyCenter(parentNode, parentKeyIndex),
        );
        const mergedKeys = [...keepKeys, command.payload.parentKey, ...absorbKeys];
        const nextParentKeys = [...parentKeys];
        nextParentKeys.splice(parentKeyIndex, 1);
        const keepTargetPos = this.getNodeTargetPosition(keepNode, positions);
        const mergedKeyCenter = this.getKeyCenterAtPosition(
            keepNode,
            keepKeys.length,
            keepTargetPos,
        );

        const tl = gsap.timeline({
            onComplete: () => {
                this.removeFloatingDisplay(parentKeyText);
                this.refreshNodeKeys(keepNode, mergedKeys, positions);
                this.refreshNodeKeys(parentNode, nextParentKeys, positions);
                this.viewManager.removeNodeView(command.payload.absorbNodeId);
            },
        });

        this.addPositionTweens(
            tl,
            [keepNode, parentNode],
            positions,
            0,
            this.standardDuration / 1800,
        );

        tl.to(parentKeyText, {
            pixi: {
                x: mergedKeyCenter.x,
                y: mergedKeyCenter.y,
            },
            duration: this.standardDuration / 1800,
            ease: "power2.inOut",
        }).to(
            absorbNode,
            {
                pixi: {
                    x: keepTargetPos?.x ?? keepNode.x,
                    y: keepTargetPos?.y ?? keepNode.y,
                    alpha: 0,
                    scaleX: 0.7,
                    scaleY: 0.7,
                },
                duration: this.standardDuration / 1800,
                ease: "power2.in",
            },
            0,
        );
    }

    handleMergeWithRight(command, positions) {
        const parentNode = this.viewManager.currentNodeViews.get(command.payload.parentId);
        const keepNode = this.viewManager.currentNodeViews.get(command.payload.keepNodeId);
        const absorbNode = this.viewManager.currentNodeViews.get(command.payload.absorbNodeId);
        if (!parentNode || !keepNode || !absorbNode) return;

        const parentKeys = this.getNodeKeys(parentNode);
        const keepKeys = this.getNodeKeys(keepNode);
        const absorbKeys = this.getNodeKeys(absorbNode);
        const parentKeyIndex = parentKeys.indexOf(command.payload.parentKey);
        if (parentKeyIndex === -1) return;

        const parentKeyText = this.createFloatingKeyText(
            command.payload.parentKey,
            this.getKeyCenter(parentNode, parentKeyIndex),
        );
        const mergedKeys = [...keepKeys, command.payload.parentKey, ...absorbKeys];
        const nextParentKeys = [...parentKeys];
        nextParentKeys.splice(parentKeyIndex, 1);
        const keepTargetPos = this.getNodeTargetPosition(keepNode, positions);
        const mergedKeyCenter = this.getKeyCenterAtPosition(
            keepNode,
            keepKeys.length,
            keepTargetPos,
        );

        const tl = gsap.timeline({
            onComplete: () => {
                this.removeFloatingDisplay(parentKeyText);
                this.refreshNodeKeys(keepNode, mergedKeys, positions);
                this.refreshNodeKeys(parentNode, nextParentKeys, positions);
                this.viewManager.removeNodeView(command.payload.absorbNodeId);
            },
        });

        this.addPositionTweens(
            tl,
            [keepNode, parentNode],
            positions,
            0,
            this.standardDuration / 1800,
        );

        tl.to(parentKeyText, {
            pixi: {
                x: mergedKeyCenter.x,
                y: mergedKeyCenter.y,
            },
            duration: this.standardDuration / 1800,
            ease: "power2.inOut",
        }).to(
            absorbNode,
            {
                pixi: {
                    x: keepTargetPos?.x ?? keepNode.x,
                    y: keepTargetPos?.y ?? keepNode.y,
                    alpha: 0,
                    scaleX: 0.7,
                    scaleY: 0.7,
                },
                duration: this.standardDuration / 1800,
                ease: "power2.in",
            },
            0,
        );
    }
}
