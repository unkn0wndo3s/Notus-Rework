"use client";
import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Modal from "@/components/ui/modal";
import { useDrawings } from "@/contexts/DrawingContext";

const ClientOnlyDrawingCanvas = dynamic(() => import("./ClientOnlyDrawingCanvas"), { ssr: false });

interface DrawingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFormatChange: (command: string, value: string) => void;
}

export default function DrawingModal({ isOpen, onClose, onFormatChange }: DrawingModalProps) {
  const canvasCtrlRef = useRef<any>(null);
  const drawingModalContentRef = useRef<HTMLDivElement>(null);
  const { drawings, setDrawings, drawingState, setDrawingState, resetDrawings } = useDrawings();

  // Mount once on page load; do not clear on open/close. Users can clear manually.

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Draw" size="full" className="sm:max-w-4xl">
      <Modal.Content>
        <div ref={drawingModalContentRef} className="w-full max-h-[80vh] relative bg-card border border-border rounded overflow-hidden">
          <div className="relative w-full h-[50vh] sm:h-[60vh] md:h-[65vh]">
            <ClientOnlyDrawingCanvas
              mode="draw"
              className="absolute inset-0 w-full h-full"
              drawings={drawings}
              setDrawings={setDrawings}
              drawingState={drawingState}
              setDrawingState={setDrawingState}
              onCanvasReady={(ctrl: any) => {
                canvasCtrlRef.current = ctrl;
              }}
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div className="flex items-center gap-3">
            <label className="text-sm shrink-0">Color</label>
            <input
              type="color"
              value={drawingState.color}
              onChange={(e) => {
                const color = e.target.value;
                setDrawingState({ color });
                canvasCtrlRef.current?.setDrawingState?.({ color });
              }}
              className="h-9 w-12 p-1 rounded border border-border bg-transparent"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm shrink-0">Size</label>
            <input
              type="range"
              min={1}
              max={24}
              value={drawingState.size}
              onChange={(e) => {
                const size = Number(e.target.value);
                setDrawingState({ size });
                canvasCtrlRef.current?.setDrawingState?.({ size });
              }}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8 text-right">{drawingState.size}</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm shrink-0">Opacity</label>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={drawingState.opacity}
              onChange={(e) => {
                const opacity = Number(e.target.value);
                setDrawingState({ opacity });
                canvasCtrlRef.current?.setDrawingState?.({ opacity });
              }}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(drawingState.opacity * 100)}%</span>
          </div>
        </div>
      </Modal.Content>
      <Modal.Footer>
        <button
          type="button"
          className="px-3 py-2 rounded bg-muted hover:bg-muted/80"
          onClick={() => {
            // Reset
            resetDrawings();
            canvasCtrlRef.current?.clearCanvas?.();
          }}
        >
          Clear
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={async () => {
            try {
              const dataUrl = canvasCtrlRef.current?.exportAsDataURL?.();
              if (dataUrl) {
                onFormatChange('insertImage', dataUrl);
                // clear canvas state so reopening shows empty canvas
                resetDrawings();
                try {
                  const ctrl = canvasCtrlRef.current;
                  if (ctrl) {
                    if (typeof ctrl.clearAndSync === 'function') await ctrl.clearAndSync();
                    else if (typeof ctrl.clearCanvas === 'function') ctrl.clearCanvas();
                  }
                } catch (_e) {
                  // ignore
                }
                onClose();
              }
            } catch (e) {
              console.error(e);
            }
          }}
        >
          Insert image
        </button>
      </Modal.Footer>
    </Modal>
  );
}
