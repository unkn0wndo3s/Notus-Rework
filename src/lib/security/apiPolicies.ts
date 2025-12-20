import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { DocumentService } from "../services/DocumentService";
import { prisma } from "../prisma";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

type PolicyEnforcer = (context: PolicyContext) => Promise<NextResponse | null>;

interface PolicyContext {
  request: NextRequest;
  pathname: string;
  authContext: AuthContext | null;
}

export interface RoutePolicy {
  id: string;
  matcher: RegExp;
  methods: HttpMethod[];
  description: string;
  jsonBodyFor?: HttpMethod[];
  maxBodySize?: number;
  enforce?: PolicyEnforcer;
  requireAuth?: boolean;
  requireAdmin?: boolean;
}

const DEFAULT_JSON_BODY_LIMIT = 512 * 1024; // 512 KB
const documentAccessService = new DocumentService();

interface AuthContext {
  userId: number | null;
  email: string | null;
  isAdmin: boolean;
}

const jsonMethodSet = new Set<HttpMethod>(["POST", "PUT", "PATCH", "DELETE"]);

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

function matchRoutePolicy(pathname: string): RoutePolicy | undefined {
  return apiRoutePolicies.find((policy) => policy.matcher.test(pathname));
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseDocumentIdFromBody(body: Record<string, unknown> | null | undefined): number | null {
  if (!body) return null;
  const candidates = [body.documentId, body.document_id, body.id_doc, body.docId, body.id];
  for (const candidate of candidates) {
    const asNumber = toNumber(candidate);
    if (asNumber) {
      return asNumber;
    }
  }
  return null;
}

function parseDocumentIdFromParams(
  params: URLSearchParams,
  keys: string[] = ["id", "documentId", "docId", "document_id", "id_doc"]
): number | null {
  for (const key of keys) {
    const value = params.get(key);
    if (!value) continue;
    const parsed = toNumber(value);
    if (parsed) return parsed;
  }
  return null;
}

async function parseJsonBody<T = Record<string, unknown>>(request: NextRequest): Promise<T | null> {
  try {
    const cloned = request.clone();
    return (await cloned.json()) as T;
  } catch {
    return null;
  }
}

async function extractAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    console.error("[apiPolicies] Missing AUTH_SECRET: impossible to decode session.");
    return null;
  }

  try {
    const token = await getToken({ req: request, secret });
    if (!token) {
      return null;
    }

    const rawId = (token as Record<string, unknown>).id ?? token.sub ?? null;
    let parsedId: number | null = null;
    if (typeof rawId === "number") {
      parsedId = rawId;
    } else if (typeof rawId === "string") {
      parsedId = Number(rawId);
    }
    const userId = Number.isFinite(parsedId ?? Number.NaN) ? (parsedId as number) : null;

    const email =
      typeof token.email === "string" ? token.email.toLowerCase().trim() : null;

    const isAdmin =
      typeof (token as Record<string, unknown>).isAdmin === "boolean"
        ? Boolean((token as Record<string, unknown>).isAdmin)
        : false;

    return { userId, email, isAdmin };
  } catch (error) {
    console.error("[apiPolicies] Error decoding NextAuth token:", error);
    return null;
  }
}

async function ensureDocumentOwnership(
  authContext: AuthContext | null,
  documentId: number | null,
  { allowAdmin = true }: { allowAdmin?: boolean } = {}
) {
  if (!documentId || documentId <= 0) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 400 }
    );
  }

  const ownerResult = await documentAccessService.ownerIdForDocument(documentId);
  if (!ownerResult.success) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }

  const ownerId = ownerResult.data?.ownerId ?? null;
  if (!ownerId) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 404 }
    );
  }

  const isOwner = authContext?.userId != null && authContext.userId === ownerId;
  const isAdmin = allowAdmin && (authContext?.isAdmin ?? false);

  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  return null;
}

async function enforceDocumentOwnershipFromBody(context: PolicyContext) {
  const body = await parseJsonBody<Record<string, unknown>>(context.request);
  const documentId = parseDocumentIdFromBody(body);
  return ensureDocumentOwnership(context.authContext, documentId);
}

async function enforceDocumentOwnershipFromQuery(context: PolicyContext) {
  const { searchParams } = new URL(context.request.url);
  const documentId = parseDocumentIdFromParams(searchParams, ["id", "documentId"]);
  return ensureDocumentOwnership(context.authContext, documentId);
}

async function enforceSharedEmailMatchesContext(context: PolicyContext) {
  const authContext = context.authContext;
  if (!authContext?.email) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(context.request.url);
  const requestedEmail = searchParams.get("email")?.toLowerCase().trim();

  if (!requestedEmail) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 400 }
    );
  }

  if (requestedEmail !== authContext.email) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  return null;
}

async function enforceRequestsAccess(context: PolicyContext) {
  const authContext = context.authContext;
  if (!authContext) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 401 }
    );
  }

  if (context.request.method !== "GET") {
    return null;
  }

  const { searchParams } = new URL(context.request.url);
  const requestedUserId = toNumber(searchParams.get("userId"));

  if (!requestedUserId) {
    if (authContext.isAdmin) {
      return null;
    }
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  const isSelf = authContext.userId === requestedUserId;

  if (!isSelf && !authContext.isAdmin) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  return null;
}

export const apiRoutePolicies: RoutePolicy[] = [

  {
    id: "folders-documents",
    description: "Add or remove documents in a folder",
    matcher: /^\/api\/folders\/[^/]+\/documents$/,
    methods: ["POST", "DELETE"],
    jsonBodyFor: ["POST", "DELETE"],
    requireAuth: true,
    enforce: enforceFolderOwnershipFromPath,
  },
  {
    id: "admin-requests-resolve",
    description: "Resolve an assistance request",
    matcher: /^\/api\/admin\/requests\/[^/]+\/resolve$/,
    methods: ["POST"],
    requireAdmin: true,
  },
  {
    id: "admin-requests-reject",
    description: "Reject an assistance request",
    matcher: /^\/api\/admin\/requests\/[^/]+\/reject$/,
    methods: ["POST"],
    requireAdmin: true,
  },
  {
    id: "admin-requests-detail",
    description: "Read, update or delete a request",
    matcher: /^\/api\/admin\/requests\/[^/]+$/,
    methods: ["GET", "PATCH", "DELETE"],
    jsonBodyFor: ["PATCH"],
    requireAdmin: true,
  },
  {
    id: "admin-users-admin-toggle",
    description: "Promote or demote a user",
    matcher: /^\/api\/admin\/users\/[^/]+\/admin$/,
    methods: ["PATCH"],
    jsonBodyFor: ["PATCH"],
    requireAdmin: true,
  },
  {
    id: "admin-users-ban-toggle",
    description: "Ban or unban a user",
    matcher: /^\/api\/admin\/users\/[^/]+\/ban$/,
    methods: ["PATCH"],
    jsonBodyFor: ["PATCH"],
    requireAdmin: true,
  },
  {
    id: "notification-mark-read",
    description: "Mark a notification as read",
    matcher: /^\/api\/notification\/mark-read$/,
    methods: ["POST"],
    jsonBodyFor: ["POST"],
    requireAuth: true,
  },
  {
    id: "notification-delete",
    description: "Explicitly delete a notification",
    matcher: /^\/api\/notification\/delete$/,
    methods: ["DELETE"],
    requireAuth: true,
  },

  {
    id: "invite-share",
    description: "Invite a collaborator to a document",
    matcher: /^\/api\/invite-share$/,
    methods: ["POST"],
    jsonBodyFor: ["POST"],
    requireAuth: true,
    enforce: enforceDocumentOwnershipFromBody,
  },
  {
    id: "confirm-share",
    description: "Confirm a share invitation",
    matcher: /^\/api\/confirm-share$/,
    methods: ["GET"],
  },

  {
    id: "verify-email",
    description: "Email address validation by token",
    matcher: /^\/api\/verify-email$/,
    methods: ["POST"],
    jsonBodyFor: ["POST"],
  },
  {
    id: "admin-stats",
    description: "Administrator dashboard",
    matcher: /^\/api\/admin\/stats$/,
    methods: ["GET"],
    requireAdmin: true,
  },
  {
    id: "admin-check-status",
    description: "Quick check of admin status",
    matcher: /^\/api\/admin\/check-status$/,
    methods: ["GET"],
    requireAuth: true,
  },
  {
    id: "next-auth",
    description: "Handlers NextAuth (session, callback, providers)",
    matcher: /^\/api\/auth(?:\/.*)?$/,
    methods: ["GET", "POST"],
  },
  {
    id: "socket-handshake",
    description: "Socket.IO server initialization",
    matcher: /^\/api\/socket$/,
    methods: ["GET"],
    requireAuth: true,
  },
];

async function enforceOpenDocAccess({ request, authContext, pathname }: PolicyContext) {
  const { searchParams } = new URL(request.url);
  // Accept "id" or "documentId" as parameter
  const documentId = parseDocumentIdFromParams(searchParams, ["id", "documentId"]);

  if (!documentId) {
    console.log(`[enforceOpenDocAccess] ${pathname}: documentId missing`);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 400 }
    );
  }

  if (!authContext || (!authContext.userId && !authContext.email)) {
    console.log(`[enforceOpenDocAccess] ${pathname}: authContext missing`);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 401 }
    );
  }

  // Verify document access
  const hasAccess = await documentAccessService.userHasAccessToDocument(
    documentId,
    authContext.userId ?? undefined,
    authContext.email ?? undefined
  );

  console.log(`[enforceOpenDocAccess] ${pathname}: documentId=${documentId}, userId=${authContext.userId}, email=${authContext.email}, hasAccess=${hasAccess}`);

  if (!hasAccess) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  return null;
}

async function enforceDocumentAccessFromQuery(context: PolicyContext) {
  const { searchParams } = new URL(context.request.url);
  const documentId = parseDocumentIdFromParams(searchParams, ["documentId", "id"]);

  if (!documentId) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 400 }
    );
  }

  if (!context.authContext || (!context.authContext.userId && !context.authContext.email)) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 401 }
    );
  }

  // Verify access to document
  const hasAccess = await documentAccessService.userHasAccessToDocument(
    documentId,
    context.authContext.userId ?? undefined,
    context.authContext.email ?? undefined
  );

  if (!hasAccess) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  return null;
}

async function enforceFolderOwnershipFromPath(context: PolicyContext) {
  if (!context.authContext?.userId) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 401 }
    );
  }

  // Extract folder ID from pathname
  // Format: /api/folders/123 or /api/folders/123/documents
  const match = /^\/api\/folders\/([^/]+)/.exec(context.pathname);
  if (!match) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 400 }
    );
  }

  const folderId = toNumber(match[1]);
  if (!folderId || folderId <= 0) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 400 }
    );
  }

  // Verify folder ownership
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, user_id: context.authContext.userId },
  });

  if (!folder) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  return null;
}

export async function enforceApiPolicies(request: NextRequest) {
  const pathname = normalizePathname(request.nextUrl.pathname);
  const policy = matchRoutePolicy(pathname);

  if (!policy) {
    console.warn(`[apiPolicies] Undeclared route: ${pathname}`);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 404 }
    );
  }

  if (pathname.includes("/history")) {
    console.log(`[apiPolicies] History route detected: ${pathname}, policy: ${policy.id}`);
  }

  const method = request.method.toUpperCase() as HttpMethod;

  if (method === "OPTIONS") {
    return null;
  }

  if (method === "HEAD" && policy.methods.includes("GET")) {
    return null;
  }

  if (!policy.methods.includes(method)) {
    return NextResponse.json(
      {
        success: false,
        error: `Method ${method} not authorized on ${pathname}`,
      },
      {
        status: 405,
        headers: {
          Allow: policy.methods.join(", "),
        },
      }
    );
  }

  const jsonError = await checkJsonEnforcement(request, method, policy);
  if (jsonError) return jsonError;

  let authContext: AuthContext | null = null;

  if (policy.requireAuth || policy.requireAdmin) {
    const authResult = await checkAuthEnforcement(request, policy);
    if ('error' in authResult) {
      return authResult.error; // it's a NextResponse
    }
    authContext = authResult.context;
  }

  if (policy.enforce) {
    const customResponse = await policy.enforce({ request, pathname, authContext });
    if (customResponse) {
      return customResponse;
    }
  }

  return null;
}

async function checkJsonEnforcement(request: NextRequest, method: HttpMethod, policy: RoutePolicy): Promise<NextResponse | null> {
  const jsonMethods = new Set<HttpMethod>(policy.jsonBodyFor ?? []);
  const shouldEnforceJson = jsonMethods.has(method) && jsonMethodSet.has(method);

  if (!shouldEnforceJson) return null;

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 415 }
    );
  }

  const limit = policy.maxBodySize ?? DEFAULT_JSON_BODY_LIMIT;
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isNaN(contentLength) && contentLength > limit) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 413 }
      );
    }
  }
  return null;
}

async function checkAuthEnforcement(request: NextRequest, policy: RoutePolicy): Promise<{ error: NextResponse } | { context: AuthContext }> {
  const authContext = await extractAuthContext(request);

  if (!authContext) {
    return {
      error: NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 401 }
      )
    };
  }

  if (policy.requireAdmin && !authContext.isAdmin) {
    return {
      error: NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      )
    };
  }

  return { context: authContext };
}


