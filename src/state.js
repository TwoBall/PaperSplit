/**
 * 全局状态管理
 */
export const state = {
    pdfDoc: null,         // PDF.js 文档对象
    currentPage: 1,       // 当前页码
    totalPages: 0,        // 总页数
    scale: 1.5,           // 渲染缩放比例
    pagesData: {},        // 页面配置数据 { pageIndex: { splitX, sealLine } }
    fileName: 'document', // 当前文件名
    isPdf: true,          // 文件类型标识
    fileData: null        // 图片文件数据 (DataURL)
};

/**
 * 重置全局状态到初始值
 * 用于加载新文件前清理旧数据
 */
export function resetState() {
    state.pdfDoc = null;
    state.currentPage = 1;
    state.totalPages = 0;
    state.pagesData = {};
    state.fileData = null;
}
