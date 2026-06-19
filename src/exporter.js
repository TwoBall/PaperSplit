import { jsPDF } from 'jspdf';
import { state } from './state.js';
import { elements } from './dom.js';
import { getPageConfig } from './editor.js';

/**
 * 导出处理后的 PDF
 * 遍历每一页，根据切割线和密封线裁剪，每页生成贴合裁剪区域的页面 (高度对齐 A4)
 */
export async function exportPdf() {
    if (!state.pdfDoc && !state.fileData) return;

    elements.exportBtn.disabled = true;
    elements.exportBtn.textContent = '生成中...';

    // 导出适配模式：'a4-fit'(等比留白) | 'a4-fill'(拉伸填满) | 'wysiwyg'(原始裁剪尺寸)
    const fit = elements.exportFitSelect ? elements.exportFitSelect.value : 'a4-fit';

    try {
        // 延迟创建：首页尺寸需贴合第一片裁剪区域 (所见即所得)
        let doc = null;

        // 遍历所有原始页面
        for (let i = 1; i <= state.totalPages; i++) {
            const config = getPageConfig(i);

            // 准备切割区间
            // 基础区间: [0, split, 1]
            let ranges = [];

            // 逻辑:
            // 1. 根据密封线确定有效区域
            // 2. 在有效区域内进行左右分割

            const splitX = config.splitX;
            const seal = config.sealLine;

            if (seal) {
                // 密封方向由 seal.type 决定（与线的语义一致），不受其相对分割线的位置影响。
                // 分割点钳制到保留区域内，避免密封线被拖过分割线时产生反向切片或漏出密封区。
                if (seal.type === 'left') {
                    // 左侧密封：丢弃 [0, Seal]，保留 [Seal, 1] 再按分割线切分
                    const split = Math.min(Math.max(splitX, seal.x), 1);
                    ranges.push([seal.x, split]);
                    ranges.push([split, 1]);
                } else {
                    // 右侧密封：丢弃 [Seal, 1]，保留 [0, Seal] 再按分割线切分
                    const split = Math.max(Math.min(splitX, seal.x), 0);
                    ranges.push([0, split]);
                    ranges.push([split, seal.x]);
                }
            } else {
                // 无密封: [0 -> Split], [Split -> 1]
                ranges.push([0, splitX]);
                ranges.push([splitX, 1]);
            }

            // 渲染高清 Canvas (2倍缩放以保证清晰度)
            let sourceCanvas;
            if (state.isPdf) {
                const page = await state.pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: 2 });
                sourceCanvas = document.createElement('canvas');
                sourceCanvas.width = viewport.width;
                sourceCanvas.height = viewport.height;
                await page.render({ canvasContext: sourceCanvas.getContext('2d'), viewport }).promise;
            } else {
                const img = new Image();
                img.src = state.fileData;
                await new Promise(r => img.onload = r);
                sourceCanvas = document.createElement('canvas');
                sourceCanvas.width = img.width;
                sourceCanvas.height = img.height;
                sourceCanvas.getContext('2d').drawImage(img, 0, 0);
            }

            // 执行切割
            for (let rng of ranges) {
                const startXRatio = rng[0];
                const endXRatio = rng[1];
                const widthRatio = endXRatio - startXRatio;

                // 忽略过小的切片
                if (widthRatio <= 0.01) continue;

                const sx = sourceCanvas.width * startXRatio;
                const sy = 0;
                const sWidth = sourceCanvas.width * widthRatio;
                const sHeight = sourceCanvas.height;

                // 创建切片 Canvas
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = sWidth;
                sliceCanvas.height = sHeight;
                sliceCanvas.getContext('2d').drawImage(sourceCanvas, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

                const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);

                // 根据导出适配模式确定页面尺寸与图片绘制区域
                let pageWidth, pageHeight, orientation;
                let drawX, drawY, drawW, drawH;

                if (fit === 'wysiwyg') {
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
                        // 拉伸填满：图片铺满整页，切偏时内容会被轻微拉伸变形
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
