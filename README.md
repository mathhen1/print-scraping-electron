# PrintScraping

Aplicativo desktop pessoal para capturar screenshots, recortar imagens e extrair texto com OCR. Feito com Electron, Node.js, TypeScript e React; as capturas ficam no disco local.

## Requisitos

- Node.js 20 ou superior
- Windows, macOS ou Linux com ambiente gráfico

## Começar

```bash
npm install
npm start
```

O botão **Nova captura** e a tecla **Print Screen** capturam a tela principal. Arraste sobre a imagem para selecionar uma região e use **Aplicar corte**. **Scraping: copiar texto** executa OCR em português e inglês. A primeira execução do OCR pode baixar os modelos de idioma.

As imagens PNG salvas ficam em `Imagens/PrintScraping` dentro da pasta de imagens do usuário. O OCR é executado no aplicativo; o texto não é enviado a um serviço remoto.

## Modo segundo plano

Ative **Segundo plano** e feche a janela para ocultá-la. O processo continua ativo; pressione Print Screen para reabrir a janela e capturar a tela. Desative o modo para que fechar a janela encerre o aplicativo.

## Estrutura

```text
src/
  main/       processo principal Electron, captura e gravação local
  preload/    ponte IPC segura para a interface
  renderer/   interface React, canvas de edição e OCR
vite.config.ts bundle da interface React
```
