import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    // index.html이 들어있는 폴더를 지정
    root: 'templates',
    build: {
        // 빌드 결과물(dist)은 다시 루트 밖으로 뽑아내기
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'templates/index.html'),
            },
        },
    },
})