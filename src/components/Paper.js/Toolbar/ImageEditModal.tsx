"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useEffect } from "react";
import Modal from "@/components/ui/modal";

interface ImageEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFormatChange: (command: string, value: string) => void;
  canEditImage: boolean;
  imageInfo: { src: string; naturalWidth: number; naturalHeight: number; styleWidth: string; styleHeight: string } | null;
}

export default function ImageEditModal({ 
  isOpen, 
  onClose, 
  onFormatChange, 
  canEditImage, 
  imageInfo 
}: Readonly<ImageEditModalProps>) {
  const imageRef = useRef<HTMLImageElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [widthPercent, setWidthPercent] = useState<number>(100);

  // Crop interactions
  const getRelativePos = (clientX: number, clientY: number) => {
    const container = cropContainerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const x = Math.min(Math.max(0, clientX - rect.left), rect.width);
    const y = Math.min(Math.max(0, clientY - rect.top), rect.height);
    return { x, y };
  };

  const handleCropMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsCropping(true);
    const p = getRelativePos(e.clientX, e.clientY);
    setCropStart(p);
    setCropRect({ x: p.x, y: p.y, width: 0, height: 0 });
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isCropping || !cropStart || !cropContainerRef.current) return;
    const p = getRelativePos(e.clientX, e.clientY);
    const x = Math.min(cropStart.x, p.x);
    const y = Math.min(cropStart.y, p.y);
    const width = Math.abs(p.x - cropStart.x);
    const height = Math.abs(p.y - cropStart.y);
    setCropRect({ x, y, width, height });
  };

  const handleCropMouseUp = (e: React.MouseEvent) => {
    if (!isCropping) return;
    e.preventDefault();
    setIsCropping(false);
  };

  const resetCrop = () => {
    // Default to full image area when opening
    const container = cropContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setCropRect({ x: 0, y: 0, width: rect.width, height: rect.height });
    setCropStart({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => resetCrop(), 0);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && imageInfo) {
      const t = setTimeout(() => resetCrop(), 0);
      return () => clearTimeout(t);
    }
  }, [imageInfo, isOpen]);

  useEffect(() => {
    if (isOpen && imageInfo) {
      const styleWidth = imageInfo.styleWidth || "";
      if (styleWidth.includes("%")) {
        const parsed = Number.parseFloat(styleWidth);
        if (!Number.isNaN(parsed)) {
          setWidthPercent(Math.max(1, Math.min(100, Math.round(parsed))));
          return;
        }
      }
      setWidthPercent(100);
    } else if (!isOpen) {
      setWidthPercent(100);
    }
  }, [imageInfo, isOpen]);

  const applyResizeOnly = () => {
    try {
      onFormatChange('setImageWidth', JSON.stringify({ widthPercent }));
      onClose();
    } catch (err) {
      console.error("ImageEditModal: error setting image width", err);
      onFormatChange('setImageWidth', String(widthPercent));
      onClose();
    }
  };

  const applyCropAndReplace = async () => {
    if (!imageInfo || !imageRef.current || !cropContainerRef.current) return;
    const dispRect = cropContainerRef.current.getBoundingClientRect();
    const sel = cropRect && cropRect.width > 0 && cropRect.height > 0
      ? cropRect
      : { x: 0, y: 0, width: dispRect.width, height: dispRect.height };
    // Map displayed selection to natural pixels
    const scaleX = imageInfo.naturalWidth / dispRect.width;
    const scaleY = imageInfo.naturalHeight / dispRect.height;
    const sx = Math.round(sel.x * scaleX);
    const sy = Math.round(sel.y * scaleY);
    const sw = Math.max(1, Math.round(sel.width * scaleX));
    const sh = Math.max(1, Math.round(sel.height * scaleY));
    // Draw to canvas
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const tmpImg = new Image();
    // Ensure CORS-safe data URLs and same-origin URLs
    tmpImg.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      tmpImg.onload = () => resolve();
      tmpImg.onerror = () => reject(new Error("Failed to load image for cropping"));
      tmpImg.src = imageInfo.src;
    }).catch((err) => {
      console.error("ImageEditModal: error loading image", err);
    });
    try {
      ctx.drawImage(tmpImg, sx, sy, sw, sh, 0, 0, sw, sh);
      const dataUrl = canvas.toDataURL('image/png');
      onFormatChange('replaceSelectedImage', JSON.stringify({ src: dataUrl, widthPercent }));
      onClose();
    } catch (err) {
      console.error("ImageEditModal: error cropping image", err);
      // Fallback: just set width
      applyResizeOnly();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit image" size="lg">
      <Modal.Content>
        {imageInfo ? (
          <div className="space-y-4">
            <section
              ref={cropContainerRef}
              onMouseDown={handleCropMouseDown}
              onMouseMove={handleCropMouseMove}
              onMouseUp={handleCropMouseUp}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  resetCrop();
                }
              }}
              tabIndex={0}
              aria-label="Image cropping area"
              className="relative w-full max-h-[60vh] overflow-hidden bg-muted border border-border rounded"
              style={{ aspectRatio: `${imageInfo.naturalWidth}/${imageInfo.naturalHeight}` } as React.CSSProperties}
            >
              <img
                ref={imageRef}
                src={imageInfo.src}
                alt="selected"
                className="w-full h-full object-contain select-none pointer-events-none"
                draggable={false}
              />
              {cropRect && (
                <div
                  className="absolute border-2 border-primary bg-primary/10"
                  style={{ left: `${cropRect.x}px`, top: `${cropRect.y}px`, width: `${cropRect.width}px`, height: `${cropRect.height}px` }}
                />
              )}
            </section>

              <div className="space-y-2">
              <label htmlFor="image-width-slider" className="text-sm">Display width</label>
              <div className="flex items-center gap-3">
                <input
                  id="image-width-slider"
                  type="range"
                  min={1}
                  max={100}
                  value={widthPercent}
                  onChange={(e) => setWidthPercent(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs w-12 text-right">{widthPercent}%</span>
                <button
                  type="button"
                  className="px-3 py-1 rounded bg-muted hover:bg-muted/80"
                  onClick={() => setWidthPercent(100)}
                >
                  100%
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Tip: click and drag on the image to define the crop area.</span>
              <button type="button" className="underline" onClick={resetCrop}>Full selection</button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No image selected.</div>
        )}
      </Modal.Content>
      <Modal.Footer>
        <button
          type="button"
          className="px-3 py-2 rounded bg-muted hover:bg-muted/80"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded bg-muted hover:bg-muted/80"
          onClick={applyResizeOnly}
          disabled={!canEditImage}
        >
          Apply width
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={applyCropAndReplace}
          disabled={!canEditImage}
        >
          Crop and replace
        </button>
      </Modal.Footer>
    </Modal>
  );
}
