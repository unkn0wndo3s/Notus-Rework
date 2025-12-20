"use client";
import { useState, useEffect } from "react";
import DrawingCanvas from "../DrawingCanvas";

interface Drawing {
  segments: Array<{
    point: [number, number];
    handleIn?: [number, number] | null;
    handleOut?: [number, number] | null;
  }>;
  color: string;
  size: number;
  opacity: number;
  closed?: boolean;
}

interface DrawingState {
  color: string;
  size: number;
  opacity: number;
}

interface ClientOnlyDrawingCanvasProps {
  mode: string;
  className?: string;
  drawings?: Drawing[];
  setDrawings: (drawings: Drawing[] | ((prev: Drawing[]) => Drawing[])) => void;
  onDrawingData?: (drawing: Drawing) => void;
  onCanvasReady?: (canvasCtrl: any) => void;
  hasLoadedInitialDrawingsRef?: React.MutableRefObject<boolean>;
  drawingState?: DrawingState;
  setDrawingState?: (state: DrawingState | ((prev: DrawingState) => DrawingState) | Partial<DrawingState>) => void;
  [key: string]: any;
}

export default function ClientOnlyDrawingCanvas({ mode, ...props }: Readonly<ClientOnlyDrawingCanvasProps>) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className={`relative ${props.className || ""}`}>
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <p className="text-muted-foreground">
            Loading canvas...
          </p>
        </div>
      </div>
    );
  }

  return <DrawingCanvas mode={mode} {...props} />;
}
