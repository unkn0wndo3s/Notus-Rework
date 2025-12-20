"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DocumentService } from "@/lib/services/DocumentService";
import { prisma } from "@/lib/prisma";
import { Ollama } from "ollama";
import { ActionResult } from "@/lib/types";

const documentService = new DocumentService();

// --- Helper Functions (Internal) ---

async function getTokenLimit(): Promise<number> {
  try {
    const setting = await (prisma as any).appSetting.findUnique({
      where: { key: "ai_token_limit_per_day" },
    });
    return setting ? parseInt(setting.value, 10) : 10000;
  } catch (error) {
    console.error("❌ Error retrieving limit:", error);
    return 10000;
  }
}

async function getTodayTokenUsage(userId: number): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const usage = await (prisma as any).userTokenUsage.findUnique({
      where: {
        user_id_date: {
          user_id: userId,
          date: today,
        },
      },
    });
    
    return usage?.tokens_used || 0;
  } catch (error) {
    console.error("❌ Error retrieving usage:", error);
    return 0;
  }
}

async function incrementTokenUsage(userId: number, tokens: number): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await (prisma as any).userTokenUsage.upsert({
      where: {
        user_id_date: {
          user_id: userId,
          date: today,
        },
      },
      update: {
        tokens_used: {
          increment: tokens,
        },
      },
      create: {
        user_id: userId,
        date: today,
        tokens_used: tokens,
      },
    });
  } catch (error) {
    console.error("❌ Error incrementing tokens:", error);
    throw error;
  }
}

async function isAiSynthesisEnabled(): Promise<boolean> {
  try {
    const setting = await (prisma as any).appSetting.findUnique({
      where: { key: "ai_synthesis_enabled" },
    });
    return setting?.value === "true";
  } catch (error) {
    console.error("❌ Error checking setting:", error);
    return true;
  }
}

function stripMarkdownFormatting(text: string): string {
  if (!text || typeof text !== "string") return "";
  
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\[([^\]]*)\]\([^\)]*\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^\)]*\)/g, "")
    .replace(/^[\*\-\+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// --- Server Actions ---

export async function getSynthesesAction(documentId: number): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? Number(session.user.id) : undefined;
    const userEmail = session?.user?.email as string | undefined;

    if (!userId && !userEmail) {
      return { success: false, error: "Access denied" };
    }

    if (isNaN(documentId) || documentId <= 0) {
      return { success: false, error: "Invalid document ID" };
    }

    if (!process.env.DATABASE_URL) {
      return { success: true, syntheses: [] } as ActionResult;
    }

    const hasAccess = await documentService.userHasAccessToDocument(
      documentId,
      userId,
      userEmail
    );

    if (!hasAccess) {
      return { success: false, error: "Access denied" };
    }

    const syntheses = await (prisma as any).synthesis.findMany({
      where: { document_id: documentId },
      orderBy: { created_at: "asc" },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            first_name: true,
            last_name: true,
            email: true,
            profile_image: true,
          },
        },
      },
    });

    return { success: true, syntheses: syntheses || [] } as ActionResult;
  } catch (error) {
    console.error("❌ Error getSynthesesAction:", error);
    return { success: false, error: "Error retrieving syntheses" };
  }
}

export async function createManualSynthesisAction(documentId: number, content: string): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? Number(session.user.id) : undefined;

    if (!userId) {
      return { success: false, error: "Access denied" };
    }

    if (isNaN(documentId) || documentId <= 0) {
      return { success: false, error: "Invalid document ID" };
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return { success: false, error: "Content is required" };
    }

    const trimmed = content.trim();
    if (trimmed.length > 10000) {
      return { success: false, error: "Content too long" };
    }

    if (!process.env.DATABASE_URL) {
      return { success: true, message: "Synthesis created (simulated)" };
    }

    const synthesis = await (prisma as any).synthesis.create({
      data: {
        document_id: documentId,
        user_id: userId,
        content: trimmed,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            first_name: true,
            last_name: true,
            email: true,
            profile_image: true,
          },
        },
      },
    });

    return { success: true, synthesis };
  } catch (error) {
    console.error("❌ Error createManualSynthesisAction:", error);
    return { success: false, error: "Error creating synthesis" };
  }
}

export async function getSynthesisStatusAction(): Promise<{ success: boolean; enabled: boolean }> {
  try {
    if (!process.env.DATABASE_URL) {
      return { success: true, enabled: true };
    }
    const enabled = await isAiSynthesisEnabled();
    return { success: true, enabled };
  } catch (error) {
    console.error("❌ Error getSynthesisStatusAction:", error);
    return { success: true, enabled: true };
  }
}

export async function getTokenUsageAction(): Promise<{ success: boolean; limit: number; used: number; remaining: number }> {
    try {
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id ? Number(session.user.id) : undefined;

        if (!userId) {
             // Return defaults if not logged in, or error? Existing route returns 401. 
             // Action should probably default safely or error.
             return { success: false, limit: 0, used: 0, remaining: 0 };
        }

        if (!process.env.DATABASE_URL) {
           return { success: true, limit: 10000, used: 0, remaining: 10000 };
        }

        const limit = await getTokenLimit();
        const used = await getTodayTokenUsage(userId);
        return { success: true, limit, used, remaining: Math.max(0, limit - used) };

    } catch (error) {
         console.error("❌ Error getTokenUsageAction:", error);
         return { success: false, limit: 10000, used: 0, remaining: 0 };
    }
}

export async function generateSynthesisAction(documentId: number, content: string): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? Number(session.user.id) : undefined;
    const userEmail = session?.user?.email as string | undefined;

    if (!userId) {
      return { success: false, error: "Access denied" };
    }

    const enabled = await isAiSynthesisEnabled();
    if (!enabled) {
      return { success: false, error: "AI Synthesis is disabled" };
    }

    if (isNaN(documentId) || documentId <= 0) {
      return { success: false, error: "Invalid document ID" };
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
       // Should check cleaned content
    }

    const hasAccess = await documentService.userHasAccessToDocument(
      documentId,
      userId,
      userEmail
    );

    if (!hasAccess) {
      return { success: false, error: "Access denied" };
    }

    const plainText = stripMarkdownFormatting(content);
    if (!plainText || plainText.trim().length === 0) {
      return { success: false, error: "Content is empty after formatting" };
    }

    const promptTokens = Math.ceil(plainText.length / 4);
    const estimatedResponseTokens = 1000;
    const estimatedTotalTokens = promptTokens + estimatedResponseTokens;

    const limit = await getTokenLimit();
    const used = await getTodayTokenUsage(userId);
    const remaining = limit - used;

    if (estimatedTotalTokens > remaining) {
      return { 
        success: false, 
        error: "Token limit reached", 
        data: { tokenLimit: limit, tokenUsed: used, tokenRemaining: remaining } 
      };
    }

    // Get configuration
    let ollamaConfig = {
      url: process.env.OLLAMA_URL || "http://localhost:11434",
      model: process.env.OLLAMA_MODEL || "llama3.2",
      token: process.env.OLLAMA_TOKEN || undefined,
    };

    if (process.env.DATABASE_URL) {
        try {
            const [urlSetting, modelSetting, tokenSetting] = await Promise.all([
            (prisma as any).appSetting.findUnique({ where: { key: "ollama_url" } }),
            (prisma as any).appSetting.findUnique({ where: { key: "ollama_model" } }),
            (prisma as any).appSetting.findUnique({ where: { key: "ollama_token" } }),
            ]);
            if (urlSetting?.value) ollamaConfig.url = urlSetting.value;
            if (modelSetting?.value) ollamaConfig.model = modelSetting.value;
            if (tokenSetting?.value) ollamaConfig.token = tokenSetting.value;
        } catch {}
    }

    const prompt = `You are an assistant that creates document summaries. Create a concise and structured summary of the following document. The summary must be in English and highlight key points.

Document:
${plainText.substring(0, 8000)}${plainText.length > 8000 ? "\n\n[... document truncated ...]" : ""}

Summary:`;

    let synthesisText = "";
    let actualTokens = estimatedTotalTokens;

    try {
        const ollama = new Ollama({
            host: ollamaConfig.url,
            headers: ollamaConfig.token ? { Authorization: `Bearer ${ollamaConfig.token}` } : undefined,
        });

        const response = await ollama.chat({
            model: ollamaConfig.model,
            messages: [{ role: "user", content: prompt }],
            stream: false,
        });

        synthesisText = response.message.content || "";
        
        if (response.prompt_eval_count && response.eval_count) {
            actualTokens = response.prompt_eval_count + response.eval_count;
        }

    } catch (error) {
        console.error("❌ Error calling Ollama:", error);
        return { success: false, error: "AI Generation failed" };
    }

    if (!synthesisText || synthesisText.trim().length === 0) {
         return { success: false, error: "Empty response from AI" };
    }

    // Use actual tokens if available
    const finalTokens = actualTokens !== estimatedTotalTokens ? actualTokens : promptTokens + Math.ceil(synthesisText.length / 4);

    try {
        await incrementTokenUsage(userId, finalTokens);
    } catch (e) {
        console.error("Failed to increment tokens", e);
    }

    if (process.env.DATABASE_URL) {
         const synthesis = await (prisma as any).synthesis.create({
            data: {
                document_id: documentId,
                user_id: userId,
                content: synthesisText.trim(),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                        profile_image: true,
                    },
                },
            },
        });
        return { success: true, synthesis };
    }

    return { success: true, synthesis: { content: synthesisText.trim() } };

  } catch (error) {
    console.error("❌ Error generateSynthesisAction:", error);
    return { success: false, error: "Error generating synthesis" };
  }
}
