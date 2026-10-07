import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

declare const Tesseract: {
  recognize(image: HTMLCanvasElement, language: string, options?: object): Promise<{ data: { text: string } }>;
};

type Selection = { x: number; y: number; width: number; height: number };

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [background, setBackground] = useState(false);
  const [saveDirectory, setSaveDirectory] = useState('Imagens/PrintScraping');
  const [status, setStatus] = useState('As imagens são salvas em Imagens/PrintScraping.');
  const [text, setText] = useState('');
  const [showText, setShowText] = useState(false);
  const [recognizing, setRecognizing] = useState(false);

  const draw = (currentSelection: Selection | null = selection) => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !image) return;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    context.drawImage(image, 0, 0);
    if (!currentSelection) return;
    context.save();
    context.fillStyle = 'rgba(5, 7, 11, .58)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.clearRect(currentSelection.x, currentSelection.y, currentSelection.width, currentSelection.height);
    context.drawImage(image, currentSelection.x, currentSelection.y, currentSelection.width, currentSelection.height,
      currentSelection.x, currentSelection.y, currentSelection.width, currentSelection.height);
    context.strokeStyle = '#78a9ff';
    context.lineWidth = Math.max(2, canvas.width / 700);
    context.strokeRect(currentSelection.x, currentSelection.y, currentSelection.width, currentSelection.height);
    context.restore();
  };

  const loadCapture = (dataUrl: string) => {
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setSelection(null);
      draw(null);
      setHasImage(true);
      setShowText(false);
      setStatus('Arraste sobre a imagem para selecionar uma área de corte.');
    };
    image.src = dataUrl;
  };

  useEffect(() => {
    const unsubscribeCapture = window.printScraping.onCapture(loadCapture);
    const unsubscribeSaveDirectory = window.printScraping.onSaveDirectoryChanged((directory) => {
      setSaveDirectory(directory);
      setStatus(`Pasta de destino atualizada. Novas capturas serão salvas em ${directory}`);
    });
    void window.printScraping.getSaveDirectory().then(setSaveDirectory);
    return () => {
      unsubscribeCapture();
      unsubscribeSaveDirectory();
    };
  }, []);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width, (event.clientX - bounds.left) * canvas.width / bounds.width)),
      y: Math.max(0, Math.min(canvas.height, (event.clientY - bounds.top) * canvas.height / bounds.height)),
    };
  };

  const applyCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selection || selection.width < 2 || selection.height < 2) {
      setStatus('Selecione uma área da imagem antes de cortar.');
      return;
    }
    const cropped = document.createElement('canvas');
    cropped.width = Math.round(selection.width);
    cropped.height = Math.round(selection.height);
    cropped.getContext('2d')!.drawImage(canvas, selection.x, selection.y, selection.width, selection.height,
      0, 0, cropped.width, cropped.height);
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setSelection(null);
      draw(null);
      setStatus('Corte aplicado.');
    };
    image.src = cropped.toDataURL('image/png');
  };

  const saveImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSelection(null);
    draw(null);
    try {
      const filepath = await window.printScraping.saveImage(canvas.toDataURL('image/png'));
      setStatus(`Imagem salva em ${filepath}`);
    } catch (error) {
      setStatus(`Não foi possível salvar: ${String(error)}`);
    }
  };

  const copyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSelection(null);
    draw(null);
    try {
      await window.printScraping.copyImage(canvas.toDataURL('image/png'));
      setStatus('Imagem copiada. Você já pode colá-la em outro aplicativo.');
    } catch (error) {
      setStatus(`Não foi possível copiar a imagem: ${String(error)}`);
    }
  };

  const runOcr = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSelection(null);
    draw(null);
    setRecognizing(true);
    setShowText(true);
    setText('');
    setStatus('Lendo texto da imagem… Na primeira execução, o idioma pode precisar ser baixado.');
    try {
      const { data } = await Tesseract.recognize(canvas, 'por+eng', {
        logger: (info: { status?: string; progress?: number }) => {
          if (info.status) setStatus(`Scraping: ${info.status}${info.progress ? ` (${Math.round(info.progress * 100)}%)` : ''}`);
        },
      });
      setText(data.text.trim());
      setStatus(data.text.trim() ? 'Texto reconhecido. Selecione e copie o resultado.' : 'Nenhum texto foi encontrado na imagem.');
    } catch (error) {
      setStatus(`Falha ao reconhecer texto: ${String(error)}`);
    } finally {
      setRecognizing(false);
    }
  };

  const toggleBackground = async (enabled: boolean) => {
    setBackground(enabled);
    await window.printScraping.toggleBackground(enabled);
    setStatus(enabled ? 'Modo segundo plano ativado.' : 'Modo segundo plano desativado.');
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(text);
    setStatus('Texto copiado para a área de transferência.');
  };

  return <>
    <header>
      <div><h1>PrintScraping</h1><p>Capturas e ferramentas, tudo local.</p></div>
      <label className="background-toggle"><input type="checkbox" checked={background} onChange={(event) => void toggleBackground(event.target.checked)} /> Segundo plano</label>
    </header>
    <main>
      <section className="toolbar" aria-label="Ferramentas">
        <button className="primary" onClick={() => void window.printScraping.requestCapture()}>Nova captura <kbd>Print Screen</kbd></button>
        <button disabled={!hasImage} onClick={applyCrop}>Aplicar corte</button>
        <button disabled={!hasImage || !selection} onClick={() => { setSelection(null); draw(null); setStatus('Seleção removida.'); }}>Desfazer corte</button>
        <button disabled={!hasImage} onClick={() => void copyImage()}>Copiar imagem</button>
        <button disabled={!hasImage || recognizing} onClick={() => void runOcr()}>{recognizing ? 'Lendo texto…' : 'Scraping: copiar texto'}</button>
        <button disabled={!hasImage} onClick={() => void saveImage()}>Salvar imagem</button>
      </section>
      <section className="workspace">
        {!hasImage && <div className="empty"><div className="empty-icon">▧</div><h2>Pronto para capturar</h2><p>Pressione <kbd>Print Screen</kbd> ou use o botão acima para abrir uma captura.</p></div>}
        <div className="image-wrap" hidden={!hasImage}>
          <canvas ref={canvasRef} onPointerDown={(event) => {
            if (!hasImage) return;
            const start = point(event);
            dragStartRef.current = start;
            const next = { x: start.x, y: start.y, width: 0, height: 0 };
            setSelection(next);
            draw(next);
            event.currentTarget.setPointerCapture(event.pointerId);
          }} onPointerMove={(event) => {
            const start = dragStartRef.current;
            if (!start) return;
            const current = point(event);
            const next = { x: Math.min(start.x, current.x), y: Math.min(start.y, current.y), width: Math.abs(current.x - start.x), height: Math.abs(current.y - start.y) };
            setSelection(next);
            draw(next);
          }} onPointerUp={() => { dragStartRef.current = null; }} />
        </div>
      </section>
      {showText && <section className="result"><div><h2>Texto reconhecido</h2><textarea rows={5} placeholder="O texto da imagem aparecerá aqui..." value={text} onChange={(event) => setText(event.target.value)} /></div><button disabled={!text} onClick={() => void copyText()}>Copiar texto</button></section>}
      <footer>{status} · Pasta de destino: {saveDirectory}</footer>
    </main>
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
