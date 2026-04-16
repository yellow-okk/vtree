// 所有B树操作相关的命令类型
export const CommandTypes = {
    // 节点操作
    CREATE_ROOT: "CREATE_ROOT", // 创建根节点
    INSERT_KEY: "INSERT_KEY", // 向节点插入key
    REMOVE_KEY: "REMOVE_KEY", // 从节点移除key
    REPLACE_KEY: "REPLACE_KEY", // 替换节点中的key

    // 节点状态
    OVERFLOW: "OVERFLOW", // 节点溢出
    UNDERFLOW: "UNDERFLOW", // 节点下溢

    // 分裂操作
    SPLIT_PREPARE: "SPLIT_PREPARE", // 准备分裂节点
    PUSH_UP_KEY: "PUSH_UP_KEY", // 中间key向上推送

    // 树结构变化
    NEW_ROOT: "NEW_ROOT", // 生成新根节点
    ROOT_DEMOTION: "ROOT_DEMOTION", // 根节点降级

    // 下溢处理
    BORROW_FROM_LEFT: "BORROW_FROM_LEFT", // 向左兄弟借key
    BORROW_FROM_RIGHT: "BORROW_FROM_RIGHT", // 向右兄弟借key
    MERGE_WITH_LEFT: "MERGE_WITH_LEFT", // 与左兄弟合并
    MERGE_WITH_RIGHT: "MERGE_WITH_RIGHT", // 与右兄弟合并
};

// 导出命令类型的数组形式，方便遍历
export const CommandTypeList = Object.values(CommandTypes);

// 导出命令类型的描述信息
export const CommandDescriptions = {
    [CommandTypes.INSERT_KEY]: "向节点插入key",
    [CommandTypes.REMOVE_KEY]: "从节点移除key",
    [CommandTypes.REPLACE_KEY]: "替换节点中的key",
    [CommandTypes.OVERFLOW]: "节点溢出",
    [CommandTypes.UNDERFLOW]: "节点下溢",
    [CommandTypes.SPLIT_PREPARE]: "准备分裂节点",
    [CommandTypes.PUSH_UP_KEY]: "中间key向上推送",
    [CommandTypes.NEW_ROOT]: "生成新根节点",
    [CommandTypes.ROOT_DEMOTION]: "根节点降级",
    [CommandTypes.BORROW_FROM_LEFT]: "向左兄弟借key",
    [CommandTypes.BORROW_FROM_RIGHT]: "向右兄弟借key",
    [CommandTypes.MERGE_WITH_LEFT]: "与左兄弟合并",
    [CommandTypes.MERGE_WITH_RIGHT]: "与右兄弟合并",
};
