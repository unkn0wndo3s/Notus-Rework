"use client";

import { useTheme } from "@/contexts/ThemeContext";
import NavBar from "@/components/navigation/NavBar";
import ContentWrapper from "@/components/common/ContentWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import Icon from "@/components/Icon";
import ColorPicker from "@/components/common/ColorPicker";

export default function SettingsPage() {
  const { isDark, toggleTheme, primaryColor, setPrimaryColor } = useTheme();

  return (
    <main className="min-h-screen bg-background">
      <NavBar />
      <ContentWrapper maxWidth="md">
        <section className="space-y-6">
          <header>
            <h1 className="font-title text-4xl font-regular text-foreground hidden md:block">Settings</h1>
          </header>

          <section>
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <div className="text-foreground font-medium">Theme</div>
                <div className="text-muted-foreground text-sm">Switch between light and dark mode.</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isDark}
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                onClick={toggleTheme}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleTheme();
                  }
                }}
                className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors focus:outline-none ${isDark ? "bg-primary" : "bg-muted"}`}
              >
                <span className="sr-only">Toggle theme</span>
                <span
                  className={`absolute left-1 h-8 w-8 rounded-full bg-background shadow-sm ring-1 ring-border transition-transform duration-300 ease-out flex items-center justify-center ${isDark ? "translate-x-10" : "translate-x-0"}`}
                >
                  {isDark ? (
                    <Icon name="moon" className="h-5 w-5 text-foreground/80" />
                  ) : (
                    <Icon name="sun" className="h-5 w-5 text-foreground/80" />
                  )}
                </span>
              </button>
            </CardContent>
          </Card>
          </section>

          <section>
          <Card>
            <CardHeader>
              <CardTitle>Primary Color</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="text-foreground font-medium">Interface Color</div>
                <div className="text-muted-foreground text-sm">Choose a color from the palette to customize the interface.</div>
              </div>
              <ColorPicker selectedColor={primaryColor} onColorChange={setPrimaryColor} />
            </CardContent>
          </Card>
          </section>
        </section>
      </ContentWrapper>
    </main>
  );
}


