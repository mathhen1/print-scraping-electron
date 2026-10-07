export {};

declare global {
  interface Window {
    printScraping: {
      onCapture(callback: (dataUrl: string) => void): () => void;
      toggleBackground(enabled: boolean): Promise<boolean>;
      requestCapture(): Promise<void>;
      saveImage(dataUrl: string): Promise<string>;
      copyImage(dataUrl: string): Promise<boolean>;
    };
  }
}
