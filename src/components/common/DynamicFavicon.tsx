"use client";

import { useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { DEFAULT_COLOR } from "@/lib/colorPalette";

/**
 * Component that dynamically updates the favicon based on the main color
 * Generates an SVG favicon with the logo's speech bubble icon, colored according to primaryColor
 */
export default function DynamicFavicon() {
  const { primaryColor } = useTheme();

  useEffect(() => {
    // Use the primary color or the default color
    const color = primaryColor || DEFAULT_COLOR;

    // Generate the SVG favicon with the current color
    // Uses exactly the same paths as the logo's speech bubble icon
    // The original icon is in a "0 0 196 56" viewBox, the icon goes from x:56 to x:93.5, y:9 to y:46.5
    // Icon zone: x:56, y:9, width:37.5, height:37.5
    // To fill 32x32: scale = 32/37.5 ≈ 0.8533, then translate(-56, -9) to reposition
    // Small padding (1px) to respect rounded edges: scale = 30/37.5 = 0.8
    const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="transparent" rx="5"/>
      <g transform="translate(1, 1) scale(0.8) translate(-56, -9)">
        <path d="M89.75 9H59.75C57.6875 9 56 10.6875 56 12.75V46.5L63.5 39H89.75C91.8125 39 93.5 37.3125 93.5 35.25V12.75C93.5 10.6875 91.8125 9 89.75 9ZM89.75 35.25H62L59.75 37.5V12.75H89.75V35.25Z" fill="${color}" stroke="${color}" stroke-width="1"/>
        <path d="M59.75 9.125H89.75C91.7435 9.125 93.375 10.7565 93.375 12.75V35.25C93.375 37.2435 91.7435 38.875 89.75 38.875H63.4482L63.4111 38.9111L56.125 46.1973V12.75C56.125 10.7565 57.7565 9.125 59.75 9.125ZM59.625 37.8018L59.8389 37.5889L62.0527 35.375H89.875V12.625H59.625V37.8018Z" stroke="${color}" stroke-width="0.25" fill="none" opacity="0.7"/>
      </g>
    </svg>`.trim();

    // Encode the SVG as a data URL
    const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(svgFavicon)}`;

    // Find or create the favicon link
    let faviconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    
    if (!faviconLink) {
      faviconLink = document.createElement("link");
      faviconLink.rel = "icon";
      document.head.appendChild(faviconLink);
    }

    // Update the href with the new favicon
    faviconLink.href = svgDataUrl;

    // Also update apple-touch-icon for iOS
    let appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
    if (!appleTouchIcon) {
      appleTouchIcon = document.createElement("link");
      appleTouchIcon.rel = "apple-touch-icon";
      document.head.appendChild(appleTouchIcon);
    }
    appleTouchIcon.href = svgDataUrl;
  }, [primaryColor]);

  // This component doesn't render anything visually
  return null;
}

