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

/**
 * 在切片区域内探测内容边界 (按列/行墨迹密度过滤扫描噪点)
 * @param {Uint8ClampedArray} data RGBA 像素数据
 * @param {number} width 图像宽度
 * @param {number} height 图像高度
 * @param {number} startXRatio 切片起点比例
 * @param {number} endXRatio 切片终点比例
 * @returns {null|{x0: number, y0: number, x1: number, y1: number}} 内容边界比例，空切片返回 null
 */
export function detectContentBounds(data, width, height, startXRatio, endXRatio) {
    const x0 = Math.max(0, Math.floor(startXRatio * width));
    const x1 = Math.min(width, Math.ceil(endXRatio * width));
    if (x1 - x0 < 2) return null;

    const darkThreshold = 245;
    const minColInk = Math.max(2, height * 0.002);
    const minRowInk = Math.max(2, (x1 - x0) * 0.002);

    const colInk = new Uint32Array(width);
    const rowInk = new Uint32Array(height);

    for (let y = 0; y < height; y++) {
        let rowCount = 0;
        let idx = (y * width + x0) * 4;
        for (let x = x0; x < x1; x++, idx += 4) {
            const g = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            if (g < darkThreshold) {
                rowCount++;
                colInk[x]++;
            }
        }
        rowInk[y] = rowCount;
    }

    let minX = -1;
    let maxX = -1;
    let minY = -1;
    let maxY = -1;
    for (let x = x0; x < x1; x++) {
        if (colInk[x] >= minColInk) {
            if (minX < 0) minX = x;
            maxX = x;
        }
    }
    for (let y = 0; y < height; y++) {
        if (rowInk[y] >= minRowInk) {
            if (minY < 0) minY = y;
            maxY = y;
        }
    }
    if (minX < 0 || minY < 0) return null;

    // 留少量安全边距，避免裁到文字抗锯齿边缘
    const padX = Math.max(1, Math.round(width * 0.005));
    const padY = Math.max(1, Math.round(height * 0.005));

    return {
        x0: Math.max(startXRatio, (minX - padX) / width),
        y0: Math.max(0, (minY - padY) / height),
        x1: Math.min(endXRatio, (maxX + 1 + padX) / width),
        y1: Math.min(1, (maxY + 1 + padY) / height)
    };
}
