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
                if (seal.x < splitX) {
                    // 左侧密封: [Seal -> Split], [Split -> 1]
                    ranges.push([seal.x, splitX]);
                    ranges.push([splitX, 1]);
                } else {
                    // 右侧密封: [0 -> Split], [Split -> Seal]
                    ranges.push([0, splitX]);
                    ranges.push([splitX, seal.x]);
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

                // 所见即所得：页面尺寸 = 裁剪区域。
                // 高度锁定 A4 (297mm)，宽度按裁剪比例 → 图片铺满整页，无白边、不缩放居中。
                // 标准 A3 对半切正好得到 210×297 的 A4。
                const pageHeight = 297;
                const pageWidth = pageHeight * (sWidth / sHeight);
                const orientation = pageWidth > pageHeight ? 'landscape' : 'portrait';

                if (!doc) {
                    doc = new jsPDF({ unit: 'mm', orientation, format: [pageWidth, pageHeight] });
                } else {
                    doc.addPage([pageWidth, pageHeight], orientation);
                }

                doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
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
