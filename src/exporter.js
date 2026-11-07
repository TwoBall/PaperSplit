import { jsPDF } from 'jspdf';
import { state } from './state.js';
import { elements } from './dom.js';
import { getPageConfig } from './editor.js';
import { buildColumnRanges, detectContentBounds } from './split-utils.js';

const EXPORT_SCALE = 2;
const DETECT_SCALE = 0.5;
const DETECT_MAX_IMAGE_SIDE = 900;

/**
 * 加载图片
 * @param {string} src 图片 DataURL
 * @returns {Promise<HTMLImageElement>}
 */
async function loadImage(src) {
    const img = new Image();
    img.src = src;
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
    });
    return img;
}

/**
 * 渲染用于导出的高清 Canvas
 * @param {number} pageIndex 页面索引 (1-based)
 * @returns {Promise<HTMLCanvasElement>}
 */
async function renderSourceCanvas(pageIndex) {
    if (state.isPdf) {
        const page = await state.pdfDoc.getPage(pageIndex);
        const viewport = page.getViewport({ scale: EXPORT_SCALE });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        return canvas;
    }

    const img = await loadImage(state.fileData);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas;
}

/**
 * 渲染用于内容边界探测的缩略 Canvas
 * @param {number} pageIndex 页面索引 (1-based)
 * @returns {Promise<{canvas: HTMLCanvasElement, fullWidth: number, fullHeight: number}>}
 */
async function renderDetectionCanvas(pageIndex) {
    if (state.isPdf) {
        const page = await state.pdfDoc.getPage(pageIndex);
        const full = page.getViewport({ scale: EXPORT_SCALE });
        const viewport = page.getViewport({ scale: DETECT_SCALE });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        return { canvas, fullWidth: full.width, fullHeight: full.height };
    }

    const img = await loadImage(state.fileData);
    const scale = Math.min(1, DETECT_MAX_IMAGE_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return { canvas, fullWidth: img.width, fullHeight: img.height };
}

/**
 * 扫描全文档，计算每页每片的内容边界与统一缩放比例
 * 统一比例保证所有输出页字号一致，且只裁白边、不变形
 * @returns {Promise<null|{scale: number, pages: Object}>}
 */
async function buildTrimPlan() {
    const pages = {};
    let maxContentWidth = 0;
    let maxContentHeight = 0;

    for (let i = 1; i <= state.totalPages; i++) {
        const config = getPageConfig(i);
        const ranges = buildColumnRanges(config.splits, config.sealLine);
        const { canvas, fullWidth, fullHeight } = await renderDetectionCanvas(i);
        const width = canvas.width;
        const height = canvas.height;
        const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;

        pages[i] = ranges.map(([start, end]) => {
            const bbox = detectContentBounds(data, width, height, start, end);
            if (bbox) {
                maxContentWidth = Math.max(maxContentWidth, (bbox.x1 - bbox.x0) * fullWidth);
                maxContentHeight = Math.max(maxContentHeight, (bbox.y1 - bbox.y0) * fullHeight);
            }
            return bbox;
        });
    }

    if (maxContentWidth <= 0 || maxContentHeight <= 0) return null;

    const scale = Math.min(297 / maxContentHeight, 210 / maxContentWidth);
    return { pages, scale };
}

/**
 * 导出处理后的 PDF
 * 遍历每一页，根据切割线和密封线裁剪，每页生成 A4 页面
 */
export async function exportPdf() {
    if (!state.pdfDoc && !state.fileData) return;

    elements.exportBtn.disabled = true;
    elements.exportBtn.textContent = '生成中...';

    // 导出适配模式：'a4-fit'(等比留白) | 'a4-trim'(去白边等比放大)
    // | 'a4-fill'(拉伸填满) | 'wysiwyg'(原始裁剪尺寸)
    const fit = elements.exportFitSelect ? elements.exportFitSelect.value : 'a4-fit';

    try {
        // 延迟创建：首页尺寸需贴合第一片裁剪区域 (所见即所得)
        let doc = null;

        // 去白边模式需要先扫描全文，得到统一缩放比例
        const trimPlan = fit === 'a4-trim' ? await buildTrimPlan() : null;
        const useTrim = fit === 'a4-trim' && trimPlan;

        // 遍历所有原始页面
        for (let i = 1; i <= state.totalPages; i++) {
            const config = getPageConfig(i);

            // 逻辑:
            // 1. 根据密封线确定有效区域 [lo, hi]
            // 2. 保留区域内的切割线把页面分成 N 个切片
            const ranges = buildColumnRanges(config.splits, config.sealLine);

            // 渲染高清 Canvas (2倍缩放以保证清晰度)
            const sourceCanvas = await renderSourceCanvas(i);

            // 去白边模式：每片使用探测到的内容边界；否则使用整条切片
            const sliceRects = useTrim
                ? (trimPlan.pages[i] || []).filter(Boolean).map(bbox => ({
                    sx: sourceCanvas.width * bbox.x0,
                    sy: sourceCanvas.height * bbox.y0,
                    sWidth: sourceCanvas.width * (bbox.x1 - bbox.x0),
                    sHeight: sourceCanvas.height * (bbox.y1 - bbox.y0)
                }))
                : ranges.map(([start, end]) => ({
                    sx: sourceCanvas.width * start,
                    sy: 0,
                    sWidth: sourceCanvas.width * (end - start),
                    sHeight: sourceCanvas.height
                }));

            // 执行切割
            for (const rect of sliceRects) {
                const { sx, sy, sWidth, sHeight } = rect;

                // 忽略过小的切片
                if (sWidth <= 1 || sHeight <= 1) continue;

                // 创建切片 Canvas
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = sWidth;
                sliceCanvas.height = sHeight;
                sliceCanvas.getContext('2d').drawImage(sourceCanvas, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

                const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);

                // 根据导出适配模式确定页面尺寸与图片绘制区域
                let pageWidth, pageHeight, orientation;
                let drawX, drawY, drawW, drawH;

                if (useTrim) {
                    // 去白边等比：所有切片使用统一比例，不变形，内容居中到 A4
                    pageWidth = 210; pageHeight = 297; orientation = 'portrait';
                    drawW = sWidth * trimPlan.scale;
                    drawH = sHeight * trimPlan.scale;
                    drawX = (210 - drawW) / 2;
                    drawY = (297 - drawH) / 2;
                } else if (fit === 'wysiwyg') {
                    // 所见即所得：页面尺寸 = 裁剪区域，图片铺满整页（无白边、不变形）。
                    // 高度锁定 297mm，宽度按裁剪比例。标准 A3 对半切正好得到 210×297 的 A4。
                    pageHeight = 297;
                    pageWidth = pageHeight * (sWidth / sHeight);
                    orientation = pageWidth > pageHeight ? 'landscape' : 'portrait';
                    drawX = 0; drawY = 0; drawW = pageWidth; drawH = pageHeight;
                } else {
                    // 标准 A4 纵向 (210×297mm)
                    pageWidth = 210; pageHeight = 297; orientation = 'portrait';
                    if (fit === 'a4-fill') {
                        // 拉伸填满：图片铺满整页，非 A4 比例时会拉伸变形
                        drawX = 0; drawY = 0; drawW = 210; drawH = 297;
                    } else {
                        // 等比留白 (a4-fit)：保持裁剪比例缩放并居中，切偏时四周留白、不变形
                        const sliceAspect = sWidth / sHeight;
                        const a4Aspect = 210 / 297;
                        if (sliceAspect > a4Aspect) {
                            drawW = 210; drawH = 210 / sliceAspect;
                        } else {
                            drawH = 297; drawW = 297 * sliceAspect;
                        }
                        drawX = (210 - drawW) / 2;
                        drawY = (297 - drawH) / 2;
                    }
                }

                if (!doc) {
                    doc = new jsPDF({ unit: 'mm', orientation, format: [pageWidth, pageHeight] });
                } else {
                    doc.addPage([pageWidth, pageHeight], orientation);
                }

                doc.addImage(imgData, 'JPEG', drawX, drawY, drawW, drawH);
            }
        }

        if (!doc) {
            alert('没有可导出的内容');
            return;
        }
        doc.save(`${state.fileName}(A4).pdf`);

    } catch (e) {
        console.error(e);
        alert('导出失败: ' + e.message);
    } finally {
        elements.exportBtn.disabled = false;
        elements.exportBtn.innerHTML = '<span class="material-icons">save_alt</span> 导出为 PDF (A4)';
    }
}
