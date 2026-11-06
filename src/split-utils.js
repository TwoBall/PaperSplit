/**
 * 分栏与切片计算 (纯函数，便于单独验证)
 */

/**
 * 生成指定栏数下均分的切割位置
 * @param {number} columnCount 栏数
 * @returns {number[]} 升序排列的切割线位置比例 (0-1)
 */
export function getDefaultSplits(columnCount) {
    const splits = [];
    for (let i = 1; i < columnCount; i++) {
        splits.push(i / columnCount);
    }
    return splits;
}

/**
 * 根据切割线和密封线计算每页导出的切片区间
 * @param {number[]} splits 切割线位置比例 (0-1)
 * @param {null|{x: number, type: 'left'|'right'}} sealLine 密封线
 * @returns {Array<[number, number]>} 切片区间 [start, end]
 */
export function buildColumnRanges(splits, sealLine) {
    let lo = 0;
    let hi = 1;

    if (sealLine) {
        // 密封方向由 seal.type 决定（与线的语义一致）
        if (sealLine.type === 'left') {
            // 左侧密封：丢弃 [0, Seal]，保留 [Seal, 1]
            lo = Math.min(Math.max(sealLine.x, 0), 1);
        } else {
            // 右侧密封：丢弃 [Seal, 1]，保留 [0, Seal]
            hi = Math.min(Math.max(sealLine.x, 0), 1);
        }
    }

    // 密封线位置异常时退回整页，避免产生空切片
    if (hi - lo <= 0.01) {
        lo = 0;
        hi = 1;
    }

    const sorted = [...splits].sort((a, b) => a - b);
    const boundaries = [lo, ...sorted.filter(x => x > lo && x < hi), hi];

    const ranges = [];
    for (let k = 0; k < boundaries.length - 1; k++) {
        ranges.push([boundaries[k], boundaries[k + 1]]);
    }
    return ranges;
}
