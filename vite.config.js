import { defineConfig } from 'vite';

export default defineConfig({
    base: './', // 使用相对路径，解决本地构建打开白屏问题
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'pdf-core': ['pdfjs-dist'],
                    'jspdf': ['jspdf']
                }
            }
        }
    }
});
