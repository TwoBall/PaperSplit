import { state } from './state.js';

/** 更新页面方向，所有操作均相对于当前看到的方向。 */
export function applyPageOperation(transform = {}, operation) {
    const next = { rotation: 0, flipHorizontal: false, flipVertical: false, ...transform };
    switch (operation) {
        case 'rotate-left':
        case 'rotate-right':
            next.rotation = (next.rotation + (operation === 'rotate-right' ? 90 : 270)) % 360;
            // 镜像在旋转后执行，因此转动页面时要同时交换镜像轴。
            [next.flipHorizontal, next.flipVertical] = [next.flipVertical, next.flipHorizontal];
            break;
        case 'flip-horizontal':
            next.flipHorizontal = !next.flipHorizontal;
            break;
        case 'flip-vertical':
            next.flipVertical = !next.flipVertical;
            break;
        case 'reset':
            return { rotation: 0, flipHorizontal: false, flipVertical: false };
    }
    return next;
}

/** 对实际像素应用旋转和镜像，供预览、缩略图和导出共同使用。 */
export function transformCanvas(source, { rotation = 0, flipHorizontal = false, flipVertical = false } = {}) {
    if (!rotation && !flipHorizontal && !flipVertical) return source;
    const sideways = rotation % 180 !== 0;
    const canvas = document.createElement('canvas');
    canvas.width = sideways ? source.height : source.width;
    canvas.height = sideways ? source.width : source.height;
    const context = canvas.getContext('2d');
    context.translate(canvas.width / 2, canvas.height / 2);
    context.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
    context.rotate(rotation * Math.PI / 180);
    context.drawImage(source, -source.width / 2, -source.height / 2);
    return canvas;
}

/** 渲染经过方向调整的页面，width/height 为调整后、缩放前的尺寸。 */
export async function renderPageCanvas(pageIndex, { scale = 1, maxWidth = Infinity, maxHeight = Infinity } = {}) {
    const { isPdf, pdfDoc, fileData } = state;
    const transform = { ...state.pageTransforms[pageIndex] };
    let page, image, size;
    if (isPdf) {
        page = await pdfDoc.getPage(pageIndex);
        // 保留 PDF 自带的 /Rotate，在此基础上应用用户的旋转。
        size = page.getViewport({ scale: 1 });
    } else {
        image = new Image();
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
            image.src = fileData;
        });
        size = { width: image.naturalWidth, height: image.naturalHeight };
    }

    const sideways = (transform.rotation || 0) % 180 !== 0;
    const width = sideways ? size.height : size.width;
    const height = sideways ? size.width : size.height;
    const fittedScale = Math.max(0.001, Math.min(scale, maxWidth / width, maxHeight / height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(size.width * fittedScale));
    canvas.height = Math.max(1, Math.round(size.height * fittedScale));
    const context = canvas.getContext('2d');
    if (isPdf) {
        await page.render({ canvasContext: context, viewport: page.getViewport({ scale: fittedScale }) }).promise;
    } else {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
    return { canvas: transformCanvas(canvas, transform), width, height };
}
