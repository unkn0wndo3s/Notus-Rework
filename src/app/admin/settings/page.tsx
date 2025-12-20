"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { Card, Button } from "@/components/ui";
import Icon from "@/components/Icon";
import { cn } from "@/lib/utils";
import ColorPicker from "@/components/common/ColorPicker";
import { useState, useEffect } from "react";

export default function AdminSettingsPage() {
  const { isDark, toggleTheme, primaryColor, setPrimaryColor } = useTheme();
  const [aiSynthesisEnabled, setAiSynthesisEnabled] = useState(false);
  const [tokenLimit, setTokenLimit] = useState("10000");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3.2");
  const [ollamaToken, setOllamaToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTokenLimit, setSavingTokenLimit] = useState(false);
  const [savingOllama, setSavingOllama] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        if (data.success && data.settings) {
          const enabled = data.settings["ai_synthesis_enabled"] === "true";
          setAiSynthesisEnabled(enabled);
          const limit = data.settings["ai_token_limit_per_day"] || "10000";
          setTokenLimit(limit);
          const url = data.settings["ollama_url"] || "http://localhost:11434";
          setOllamaUrl(url);
          const model = data.settings["ollama_model"] || "llama3.2";
          setOllamaModel(model);
          // Token is never sent back for security reasons
          // Field is left empty and user can modify if wanted
        }
      } catch (e) {
        console.error("Error loading settings:", e);
        setError("Unable to load settings");
      } finally {
        setLoading(false);
      }
    };
    void loadSettings();
  }, []);

  const handleToggleAiSynthesis = async () => {
    const newValue = !aiSynthesisEnabled;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "ai_synthesis_enabled",
          value: String(newValue),
          description: "Enables or disables the AI synthesis feature",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAiSynthesisEnabled(newValue);
      } else {
        setError(data.error || "Error during update");
      }
    } catch (e) {
      setError("Error during update");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTokenLimit = async () => {
    const limit = parseInt(tokenLimit, 10);
    if (isNaN(limit) || limit < 0) {
      setError("Limit must be a positive number");
      return;
    }
    setSavingTokenLimit(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "ai_token_limit_per_day",
          value: String(limit),
          description: "Token limit per user per day for AI synthesis",
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Error during update");
      }
    } catch (e) {
      setError("Error during update");
    } finally {
      setSavingTokenLimit(false);
    }
  };

  const handleSaveOllamaConfig = async () => {
    if (!ollamaUrl || ollamaUrl.trim().length === 0) {
      setError("Ollama URL is required");
      return;
    }
    if (!ollamaModel || ollamaModel.trim().length === 0) {
      setError("Ollama model is required");
      return;
    }
    setSavingOllama(true);
    setError(null);
    try {
      const updates = [
        {
          key: "ollama_url",
          value: ollamaUrl.trim(),
          description: "Ollama API URL",
        },
        {
          key: "ollama_model",
          value: ollamaModel.trim(),
          description: "Ollama model to use for syntheses",
        },
      ];

      // If token is provided, add it too
      if (ollamaToken.trim().length > 0) {
        updates.push({
          key: "ollama_token",
          value: ollamaToken.trim(),
          description: "Ollama authentication token (optional)",
        });
      }

      const results = await Promise.all(
        updates.map((update) =>
          fetch("/api/admin/settings", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(update),
          }).then((res) => res.json())
        )
      );

      const allSuccess = results.every((data) => data.success);

      if (!allSuccess) {
        setError("Error during update of Ollama configuration");
      } else {
        // Reset token field after save for security
        setOllamaToken("");
        setShowToken(false);
      }
    } catch (e) {
      setError("Error during update");
    } finally {
      setSavingOllama(false);
    }
  };

  return (
    <main className="space-y-6">
      <header className="text-center pt-10">
        <h1 className="text-3xl font-bold text-foreground">
          Admin Settings
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage your Notus application settings
        </p>
      </header>

      <section className="max-w-4xl mx-auto">
        <Card className="bg-background">
          <Card.Header>
            <Card.Title className="text-foreground text-2xl font-semibold">
              Appearance
            </Card.Title>
          </Card.Header>
          <Card.Content className="flex items-center justify-between gap-4 p-6">
            <div>
              <p className="text-foreground font-medium">Theme</p>
              <p className="text-muted-foreground text-sm">
                Switch between light and dark mode.
              </p>
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
              className={cn(
                "relative inline-flex h-10 w-20 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                isDark ? "bg-primary" : "bg-muted"
              )}
            >
              <span className="sr-only">Toggle theme</span>
              <span
                className={cn(
                  "absolute left-1 h-8 w-8 rounded-full bg-background shadow-sm ring-1 ring-border transition-transform duration-300 ease-out flex items-center justify-center",
                  isDark ? "translate-x-10" : "translate-x-0"
                )}
              >
                {isDark ? (
                  <Icon name="moon" className="h-5 w-5 text-foreground/80" />
                ) : (
                  <Icon name="sun" className="h-5 w-5 text-foreground/80" />
                )}
              </span>
            </button>
          </Card.Content>
        </Card>
      </section>

      <section className="max-w-4xl mx-auto">
        <Card className="bg-background">
          <Card.Header>
            <Card.Title className="text-foreground text-2xl font-semibold">
              Primary Color
            </Card.Title>
          </Card.Header>
          <Card.Content className="p-6">
            <div className="mb-4">
              <p className="text-foreground font-medium">Interface Color</p>
              <p className="text-muted-foreground text-sm">
                Choose a color from the palette to customize the interface.
              </p>
            </div>
            <ColorPicker selectedColor={primaryColor} onColorChange={setPrimaryColor} />
          </Card.Content>
        </Card>
      </section>

      <section className="max-w-4xl mx-auto">
        <Card className="bg-background">
          <Card.Header>
            <Card.Title className="text-foreground text-2xl font-semibold">
              AI Features
            </Card.Title>
          </Card.Header>
          <Card.Content className="flex items-center justify-between gap-4 p-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="sparkles" className="w-5 h-5 text-foreground" />
                <p className="text-foreground font-medium">AI Synthesis</p>
              </div>
              <p className="text-muted-foreground text-sm">
                Enables or disables the AI synthesis generation feature for documents.
                {loading && <span className="ml-2">Loading...</span>}
              </p>
              {error && (
                <p className="text-red-500 text-sm mt-2">{error}</p>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={aiSynthesisEnabled}
              aria-label={aiSynthesisEnabled ? "Disable AI synthesis" : "Enable AI synthesis"}
              onClick={handleToggleAiSynthesis}
              disabled={loading || saving}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (!loading && !saving) {
                    handleToggleAiSynthesis();
                  }
                }
              }}
              className={cn(
                "relative inline-flex h-10 w-20 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                aiSynthesisEnabled ? "bg-primary" : "bg-muted",
                (loading || saving) && "opacity-50 cursor-not-allowed"
              )}
            >
              <span className="sr-only">Toggle AI synthesis</span>
              <span
                className={cn(
                  "absolute left-1 h-8 w-8 rounded-full bg-background shadow-sm ring-1 ring-border transition-transform duration-300 ease-out flex items-center justify-center",
                  aiSynthesisEnabled ? "translate-x-10" : "translate-x-0"
                )}
              >
                {saving ? (
                  <Icon name="spinner" className="h-5 w-5 text-foreground/80 animate-spin" />
                ) : aiSynthesisEnabled ? (
                  <Icon name="sparkles" className="h-5 w-5 text-foreground/80" />
                ) : (
                  <Icon name="x" className="h-5 w-5 text-foreground/80" />
                )}
              </span>
            </button>
          </Card.Content>
        </Card>
      </section>

      <section className="max-w-4xl mx-auto">
        <Card className="bg-background">
          <Card.Header>
            <Card.Title className="text-foreground text-2xl font-semibold">
              Token Limit
            </Card.Title>
          </Card.Header>
          <Card.Content className="p-6">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="sparkles" className="w-5 h-5 text-foreground" />
                <p className="text-foreground font-medium">Daily limit per user</p>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Define the maximum number of tokens a user can use per day to generate AI syntheses.
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min="0"
                  value={tokenLimit}
                  onChange={(e) => setTokenLimit(e.target.value)}
                  disabled={savingTokenLimit}
                  className="px-3 py-2 border border-border rounded-md bg-background text-foreground w-32 focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-muted-foreground text-sm">tokens/day</span>
                <Button
                  onClick={handleSaveTokenLimit}
                  disabled={savingTokenLimit}
                  size="sm"
                  className="px-4 py-2"
                >
                  {savingTokenLimit ? (
                    <>
                      <Icon name="spinner" className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
              {error && (
                <p className="text-red-500 text-sm mt-2">{error}</p>
              )}
            </div>
          </Card.Content>
        </Card>
      </section>

      <section className="max-w-4xl mx-auto">
        <Card className="bg-background">
          <Card.Header>
            <Card.Title className="text-foreground text-2xl font-semibold">
              Ollama Configuration
            </Card.Title>
          </Card.Header>
          <Card.Content className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Ollama API URL
              </label>
              <input
                type="url"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                disabled={savingOllama}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Full Ollama API URL (e.g., http://localhost:11434 or https://api.ollama.com)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Ollama Model
              </label>
              <input
                type="text"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                disabled={savingOllama}
                placeholder="llama3.2"
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ollama model name to use (e.g., llama3.2, mistral, etc.)
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-foreground">
                  Authentication token (optional)
                </label>
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {showToken ? "Hide" : "Show"}
                </button>
              </div>
              <input
                type={showToken ? "text" : "password"}
                value={ollamaToken}
                onChange={(e) => setOllamaToken(e.target.value)}
                disabled={savingOllama}
                placeholder="Leave blank to not modify"
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ollama authentication token if necessary. Leave blank to keep current value.
              </p>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <Button
                onClick={handleSaveOllamaConfig}
                disabled={savingOllama}
                size="sm"
                className="px-4 py-2"
              >
                {savingOllama ? (
                  <>
                    <Icon name="spinner" className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save configuration"
                )}
              </Button>
            </div>

            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}
