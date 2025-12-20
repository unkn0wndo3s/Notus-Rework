"use client";
import { useEffect, useRef, useState, useCallback, useLayoutEffect } from "react";
import { useSocket } from "@/lib/paper.js/socket-client";
import { useLocalSession } from "@/hooks/useLocalSession";

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

// Global variable to hold current drawing state for Paper.js event handlers
let globalDrawingState: DrawingState = { color: "#000000", size: 3, opacity: 1 };

interface CanvasController {
  saveDrawings: () => Promise<Drawing[]>;
  saveAndClear: () => Promise<Drawing[]>;
  clearCanvas: () => void;
  clearAndSync?: () => Promise<void>;
  setDrawingState: (state: Partial<DrawingState>) => void;
  exportAsDataURL: () => string | null;
}

interface DrawingCanvasProps {
  drawings?: Drawing[];
  setDrawings: (drawings: Drawing[] | ((prev: Drawing[]) => Drawing[])) => void;
  onDrawingData?: (drawing: Drawing) => void;
  onCanvasReady?: (canvasCtrl: CanvasController) => void;
  className?: string;
  hasLoadedInitialDrawingsRef?: React.MutableRefObject<boolean>;
  mode?: string;
  drawingState?: DrawingState;
  setDrawingState?: (state: DrawingState | ((prev: DrawingState) => DrawingState) | Partial<DrawingState>) => void;
  startFresh?: boolean;
  [key: string]: any;
}

export default function DrawingCanvas({
  drawings = [],
  setDrawings,
  onDrawingData,
  onCanvasReady,
  className = "",
  hasLoadedInitialDrawingsRef,
  mode = "draw",
  drawingState: propDrawingState,
  setDrawingState: propSetDrawingState,
  ...props
}: DrawingCanvasProps) {
  // -------- State management --------
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<any>(null);
  const [paperScope, setPaperScope] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paperRef = useRef<any>(null);
  const clientIdRef = useRef<string | null>(null);
  const pathsRef = useRef(new Map());
  const isDrawingRef = useRef(false);
  const currentPathRef = useRef<any>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const modeRef = useRef(mode);

  // Minimum distance (in px) between sampled points to avoid too-dense vertices
  // Lower distance captures more points and allows smoother, curvier results
  const MIN_POINT_DISTANCE = 1.5; // tweak this to taste (1-3 px)

  // Session
  const { session, isLoggedIn } = useLocalSession();

  // Socket
  const { socket } = useSocket();
  const localMode = true; // Force local mode for now

  // -------- Drawing state --------
  const [localDrawingState, setLocalDrawingState] = useState<DrawingState>({
    color: "#000000",
    size: 3,
    opacity: 1,
  });

  // Use prop drawing state if available, otherwise use local state
  const drawingState = propDrawingState || localDrawingState;
  const setDrawingState = propSetDrawingState || setLocalDrawingState;

  console.log("DrawingCanvas - drawingState:", drawingState, "propDrawingState:", propDrawingState);

  // Update global drawing state for event handlers
  useLayoutEffect(() => {
    globalDrawingState = drawingState;
    console.log("useLayoutEffect - updated globalDrawingState to:", drawingState);
  }, [drawingState]);

  // When controls (color/size/opacity) change while drawing, apply to the current path immediately
  useEffect(() => {
    if (!paperScope) return;
    const current = currentPathRef.current;
    if (current) {
      try {
        const ds = globalDrawingState;
        console.log("useEffect - updating current path with:", ds);
        current.strokeColor = new paperScope.Color(ds.color);
        console.log("useEffect - setting strokeColor to:", ds.color);
        current.strokeWidth = ds.size;
        current.opacity = ds.opacity;
        paperScope.view.update();
      } catch (e) {
        // no-op
      }
    }
  }, [drawingState.color, drawingState.size, drawingState.opacity, paperScope]);

  // Canvas dimensions state
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Update refs when state changes
  useEffect(() => {
    isDrawingRef.current = isDrawing;
  }, [isDrawing]);

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Handle canvas resize
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    return () => {
      window.removeEventListener("resize", updateCanvasSize);
    };
  }, []);

  // Sync drawings from canvas to state when they change
  const syncDrawingsToState = useCallback(() => {
    if (!paperScope) return;

    const allPaths: Drawing[] = [];
    paperScope.project.activeLayer.children.forEach((item: any) => {
      if (item.className === "Path") {
        const serializedPath: Drawing = {
          segments: item.segments.map((segment: any) => ({
            point: [segment.point.x, segment.point.y] as [number, number],
            handleIn: segment.handleIn
              ? ([segment.handleIn.x, segment.handleIn.y] as [number, number])
              : null,
            handleOut: segment.handleOut
              ? ([segment.handleOut.x, segment.handleOut.y] as [number, number])
              : null,
          })),
          color: item.strokeColor?.toCSS() || "#000000",
          size: item.strokeWidth || 3,
          opacity: item.opacity || 1,
          closed: item.closed || false,
        };
        allPaths.push(serializedPath);
      }
    });

    // Always update the state with current canvas drawings
    setDrawings(allPaths);
  }, [paperScope, setDrawings]);

  // Mode is now passed as prop

  // -------- Paper.js setup --------
  const initializePaper = useCallback(async () => {
    if (!canvasRef.current || isInitialized || typeof window === "undefined")
      return;
    try {
      const paper = (await import("paper")).default;
      paperRef.current = paper;

      const canvas = canvasRef.current;

      // Set canvas size based on container
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      paper.setup(canvas);

      // Set view size to match canvas size
      paper.view.viewSize = new paper.Size(rect.width, rect.height);

      // Set up drawing tools
      const tool = new paper.Tool();

      tool.onMouseDown = (event: any) => {
        if (modeRef.current !== "draw") {
          return;
        }
        setIsDrawing(true);
        isDrawingRef.current = true;

        const path = new paper.Path();
        const ds = globalDrawingState;
        console.log("onMouseDown - globalDrawingState:", ds);
        path.strokeColor = new paper.Color(ds.color);
        console.log("onMouseDown - setting strokeColor to:", ds.color);
        path.strokeWidth = ds.size;
        path.strokeCap = "round";
        path.strokeJoin = "round";
        path.opacity = ds.opacity;

        path.add(event.point);
        lastPointRef.current = { x: event.point.x, y: event.point.y };
        setCurrentPath(path);
        currentPathRef.current = path;

        // Store in paths map
        const pathId = `path-${Date.now()}-${Math.random()}`;
        pathsRef.current.set(pathId, path);
      };

      tool.onMouseDrag = (event: any) => {
        if (
          !isDrawingRef.current ||
          !currentPathRef.current ||
          modeRef.current !== "draw"
        ) {
          return;
        }

        // Sample points to avoid many tiny segments which later simplify to corners
        const last = lastPointRef.current;
        const px = event.point.x;
        const py = event.point.y;
        if (!last) {
          currentPathRef.current.add(event.point);
          lastPointRef.current = { x: px, y: py };
        } else {
          const dx = px - last.x;
          const dy = py - last.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 >= MIN_POINT_DISTANCE * MIN_POINT_DISTANCE) {
            currentPathRef.current.add(event.point);
            lastPointRef.current = { x: px, y: py };
          }
        }
        // Live update current path style in case controls changed mid-stroke
        const ds = globalDrawingState;
        console.log("onMouseDrag - updating path style with:", ds);
        currentPathRef.current.strokeColor = new paper.Color(ds.color);
        console.log("onMouseDrag - setting strokeColor to:", ds.color);
        currentPathRef.current.strokeWidth = ds.size;
        currentPathRef.current.opacity = ds.opacity;
        paper.view.update();
      };

      // Also update style if drawingState changes mid-stroke (external prop/local)
      const observer = new MutationObserver(() => {
        if (currentPathRef.current) {
          const ds = globalDrawingState;
          console.log("MutationObserver - updating path style with:", ds);
          currentPathRef.current.strokeColor = new paper.Color(ds.color);
          console.log("MutationObserver - setting strokeColor to:", ds.color);
          currentPathRef.current.strokeWidth = ds.size;
          currentPathRef.current.opacity = ds.opacity;
        }
      });
      // Observe attribute changes on canvas element as a simple hook to trigger updates
      if (canvasRef.current) {
        observer.observe(canvasRef.current, { attributes: true });
      }

      tool.onMouseUp = (event: any) => {
        if (
          !isDrawingRef.current ||
          !currentPathRef.current ||
          modeRef.current !== "draw"
        ) {
          return;
        }

        setIsDrawing(false);
        isDrawingRef.current = false;

        // Finalize path: apply a curvier smoothing algorithm (Catmull-Rom)
        try {
          // Catmull-Rom produces nice rounded curves through the points.
          // Factor controls tension; higher => tighter curves. 0.6 is a good starting point.
          currentPathRef.current.smooth({ type: 'catmull-rom', factor: 0.6 });
        } catch (_e) {
          // Fallback to continuous smoothing if catmull-rom isn't available
          try {
            currentPathRef.current.smooth({ type: 'continuous' });
          } catch (_e) {
            // If smoothing fails entirely, keep the raw path as-is
          }
        }
        // reset last point
        lastPointRef.current = null;

        // Convert to serializable format
        const dsFinal = globalDrawingState;
        const serializedPath: Drawing = {
          segments: currentPathRef.current.segments.map((segment: any) => ({
            point: [segment.point.x, segment.point.y] as [number, number],
            handleIn: segment.handleIn
              ? ([segment.handleIn.x, segment.handleIn.y] as [number, number])
              : null,
            handleOut: segment.handleOut
              ? ([segment.handleOut.x, segment.handleOut.y] as [number, number])
              : null,
          })),
          color: dsFinal.color,
          size: dsFinal.size,
          opacity: dsFinal.opacity,
          closed: currentPathRef.current.closed,
        };

        // Add to drawings
        setDrawings((prev) => {
          const newDrawings = [...prev, serializedPath];

          // Notify parent
          if (onDrawingData) {
            onDrawingData(serializedPath);
          }

          return newDrawings;
        });

        setCurrentPath(null);
        currentPathRef.current = null;
        paper.view.update();

        // Sync drawings to state
        setTimeout(() => {
          syncDrawingsToState();
        }, 100);
      };

      setPaperScope(paper);
      setIsInitialized(true);

      // Notify parent that canvas is ready
      if (onCanvasReady) {
        onCanvasReady({
          saveDrawings: async () => {
            syncDrawingsToState();
            const allPaths: Drawing[] = [];
            paper.project.activeLayer.children.forEach((item: any) => {
              if (item.className === "Path") {
                const serializedPath: Drawing = {
                  segments: item.segments.map((segment: any) => ({
                    point: [segment.point.x, segment.point.y] as [number, number],
                    handleIn: segment.handleIn
                      ? ([segment.handleIn.x, segment.handleIn.y] as [number, number])
                      : null,
                    handleOut: segment.handleOut
                      ? ([segment.handleOut.x, segment.handleOut.y] as [number, number])
                      : null,
                  })),
                  color: item.strokeColor?.toCSS() || "#000000",
                  size: item.strokeWidth || 3,
                  opacity: item.opacity || 1,
                  closed: item.closed || false,
                };
                allPaths.push(serializedPath);
              }
            });
            return allPaths;
          },
          saveAndClear: async () => {
            syncDrawingsToState();
            const allPaths: Drawing[] = [];
            paper.project.activeLayer.children.forEach((item: any) => {
              if (item.className === "Path") {
                const serializedPath: Drawing = {
                  segments: item.segments.map((segment: any) => ({
                    point: [segment.point.x, segment.point.y] as [number, number],
                    handleIn: segment.handleIn
                      ? ([segment.handleIn.x, segment.handleIn.y] as [number, number])
                      : null,
                    handleOut: segment.handleOut
                      ? ([segment.handleOut.x, segment.handleOut.y] as [number, number])
                      : null,
                  })),
                  color: item.strokeColor?.toCSS() || "#000000",
                  size: item.strokeWidth || 3,
                  opacity: item.opacity || 1,
                  closed: item.closed || false,
                };
                allPaths.push(serializedPath);
              }
            });
            // clear canvas and state
            try { paper.project.clear(); } catch (e) { }
            pathsRef.current.clear();
            setDrawings([]);
            try { paper.view.update(); } catch (e) { }
            await new Promise((res) => setTimeout(res, 0));
            return allPaths;
          },
          clearCanvas: () => {
            paper.project.clear();
            pathsRef.current.clear();
            setDrawings([]);
          },
          clearAndSync: async () => {
            try {
              paper.project.clear();
              pathsRef.current.clear();
              setDrawings([]);
              try { paper.view.update(); } catch (e) { }
              await new Promise((res) => setTimeout(res, 0));
            } catch (e) { /* no-op */ }
          },
          setDrawingState: (newState: Partial<DrawingState>) => {
            setDrawingState((prev) => ({ ...prev, ...newState }));
          },
          exportAsDataURL: () => {
            try {
              return canvasRef.current ? canvasRef.current.toDataURL("image/png") : null;
            } catch (e) {
              return null;
            }
          }
        });
      }
    } catch (error) {
      console.error("Error initializing Paper.js:", error);
    }
  }, [
    isInitialized,
    onDrawingData,
    onCanvasReady,
    setDrawings,
    syncDrawingsToState,
    setDrawingState,
  ]);

  // -------- Load initial drawings --------
  useEffect(() => {
    if (!paperScope || !isInitialized) return;

    // If parent requested a fresh canvas, clear existing project and state
    if (props.startFresh) {
      try {
        paperScope.project.clear();
      } catch (e) { /* no-op */ }
      pathsRef.current.clear();
      setDrawings([]);
      // Ensure we don't immediately reload the old `drawings` value
      return; // <-- added: exit to avoid reloading old drawings
    }

    // Clear existing paths
    paperScope.project.clear();
    pathsRef.current.clear();

    // Load drawings
    if (Array.isArray(drawings) && drawings.length > 0) {
      drawings.forEach((drawing, index) => {
        if (!drawing || !drawing.segments) return;

        try {
          const path = new paperScope.Path();
          const color = drawing.color || globalDrawingState.color || "#000000";
          const size = drawing.size || globalDrawingState.size || 3;
          const opacity = drawing.opacity ?? globalDrawingState.opacity ?? 1;
          path.strokeColor = new paperScope.Color(color);
          path.strokeWidth = size;
          path.strokeCap = "round";
          path.strokeJoin = "round";
          path.opacity = opacity;

          drawing.segments.forEach((segment) => {
            if (segment.point && Array.isArray(segment.point)) {
              path.add(
                new paperScope.Point(segment.point[0], segment.point[1])
              );
            }
          });

          if (drawing.closed) {
            path.closePath();
          }

          const pathId = `path-${index}-${Date.now()}`;
          pathsRef.current.set(pathId, path);
        } catch (error) {
          console.error("Error loading drawing:", error);
        }
      });

      paperScope.view.draw();
    }
  }, [paperScope, isInitialized, drawings, props.startFresh, setDrawings]);

  // -------- Canvas setup --------
  useEffect(() => {
    if (typeof window !== "undefined") {
      initializePaper();
    }
  }, [initializePaper]);

  // Handle canvas resize after initialization
  useEffect(() => {
    if (!paperScope || !isInitialized) return;

    const handleResize = () => {
      if (canvasRef.current && paperScope) {
        // Save current drawings
        const currentDrawings: Drawing[] = [];
        paperScope.project.activeLayer.children.forEach((item: any) => {
          if (item.className === "Path") {
            const serializedPath: Drawing = {
              segments: item.segments.map((segment: any) => ({
                point: [segment.point.x, segment.point.y] as [number, number],
                handleIn: segment.handleIn
                  ? ([segment.handleIn.x, segment.handleIn.y] as [number, number])
                  : null,
                handleOut: segment.handleOut
                  ? ([segment.handleOut.x, segment.handleOut.y] as [number, number])
                  : null,
              })),
              color: item.strokeColor?.toCSS() || "#000000",
              size: item.strokeWidth || 3,
              opacity: item.opacity || 1,
              closed: item.closed || false,
            };
            currentDrawings.push(serializedPath);
          }
        });

        // Resize canvas
        const rect = canvasRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
        paperScope.view.viewSize = new paperScope.Size(rect.width, rect.height);

        // Restore drawings
        currentDrawings.forEach((drawing) => {
          if (drawing && drawing.segments) {
            try {
              const path = new paperScope.Path();
              path.strokeColor = new paperScope.Color(drawing.color || "#000000");
              path.strokeWidth = drawing.size || 3;
              path.strokeCap = "round";
              path.strokeJoin = "round";
              path.opacity = drawing.opacity || 1;

              drawing.segments.forEach((segment) => {
                if (segment.point && Array.isArray(segment.point)) {
                  path.add(
                    new paperScope.Point(segment.point[0], segment.point[1])
                  );
                }
              });

              if (drawing.closed) {
                path.closePath();
              }
            } catch (error) {
              console.error("Error restoring drawing after resize:", error);
            }
          }
        });

        paperScope.view.update();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [paperScope, isInitialized]);

  // Handle mode change - resize canvas when mode changes
  useEffect(() => {
    if (!paperScope || !isInitialized) return;

    const resizeCanvas = () => {
      if (canvasRef.current && paperScope) {
        const rect = canvasRef.current.getBoundingClientRect();

        // Calculate new dimensions based on container
        const newWidth = rect.width;
        const newHeight = rect.height;

        // Only resize if dimensions actually changed
        if (
          canvasRef.current.width !== newWidth ||
          canvasRef.current.height !== newHeight
        ) {
          // Save current drawings before resize
          const currentDrawings: Drawing[] = [];
          paperScope.project.activeLayer.children.forEach((item: any) => {
            if (item.className === "Path") {
              const serializedPath: Drawing = {
                segments: item.segments.map((segment: any) => ({
                  point: [segment.point.x, segment.point.y] as [number, number],
                  handleIn: segment.handleIn
                    ? ([segment.handleIn.x, segment.handleIn.y] as [number, number])
                    : null,
                  handleOut: segment.handleOut
                    ? ([segment.handleOut.x, segment.handleOut.y] as [number, number])
                    : null,
                })),
                color: item.strokeColor?.toCSS() || "#000000",
                size: item.strokeWidth || 3,
                opacity: item.opacity || 1,
                closed: item.closed || false,
              };
              currentDrawings.push(serializedPath);
            }
          });

          // Clear canvas
          paperScope.project.clear();

          // Resize canvas
          canvasRef.current.width = newWidth;
          canvasRef.current.height = newHeight;
          paperScope.view.viewSize = new paperScope.Size(newWidth, newHeight);

          // Restore drawings with scaling
          currentDrawings.forEach((drawing) => {
            if (drawing && drawing.segments) {
              try {
                const path = new paperScope.Path();
                path.strokeColor = new paperScope.Color(drawing.color || "#000000");
                path.strokeWidth = drawing.size || 3;
                path.strokeCap = "round";
                path.strokeJoin = "round";
                path.opacity = drawing.opacity || 1;

                drawing.segments.forEach((segment) => {
                  if (segment.point && Array.isArray(segment.point)) {
                    path.add(
                      new paperScope.Point(segment.point[0], segment.point[1])
                    );
                  }
                });

                if (drawing.closed) {
                  path.closePath();
                }
              } catch (error) {
                console.error(
                  "Error restoring drawing after mode change:",
                  error
                );
              }
            }
          });

          paperScope.view.update();
        }
      }
    };

    // Small delay to ensure DOM has updated
    const timeoutId = setTimeout(resizeCanvas, 50);
    return () => clearTimeout(timeoutId);
  }, [paperScope, isInitialized, mode]);

  // -------- Socket event handlers --------
  const sessionUserId = (session as any)?.user?.id;
  const handleDrawingUpdate = useCallback(
    (data: any) => {
      if (data.userId === sessionUserId || localMode) return;

      if (data.drawings && Array.isArray(data.drawings)) {
        setDrawings(data.drawings);
      }
    },
    [sessionUserId, localMode, setDrawings]
  );

  const handleClearCanvas = useCallback(() => {
    if (paperScope) {
      paperScope.project.clear();
      pathsRef.current.clear();
      setDrawings([]);
    }
  }, [paperScope, setDrawings]);

  // -------- Socket setup --------
  useEffect(() => {
    if (!socket || localMode || !isLoggedIn) return;

    socket.on("drawing-update", handleDrawingUpdate);
    socket.on("clear-canvas", handleClearCanvas);

    return () => {
      socket.off("drawing-update", handleDrawingUpdate);
      socket.off("clear-canvas", handleClearCanvas);
    };
  }, [socket, localMode, isLoggedIn, handleDrawingUpdate, handleClearCanvas]);

  // -------- Cleanup --------
  useEffect(() => {
    return () => {
      if (paperScope) {
        paperScope.project.clear();
      }
    };
  }, [paperScope]);

  // -------- Render --------
  return (
    <div className={`relative ${className}`} {...props}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        style={{
          touchAction: "none",
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "contain",
        }}
      />
    </div>
  );
}

