import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
    ssr: false,
    compatibilityDate: '2024-11-01',
    devtools: { enabled: true },
    srcDir: 'src',
    css: ['~/assets/css/main.css'],
    vite: {
        plugins: [
            tailwindcss(),
        ],
    },
    nitro: {
        preset: 'static',
    }
})
