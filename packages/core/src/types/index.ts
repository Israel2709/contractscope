export type Severity = "breaking" | "warning" | "non-breaking";

export type HttpMethod =
  | "get"
  | "put"
  | "post"
  | "delete"
  | "options"
  | "head"
  | "patch"
  | "trace";

export type ParameterLocation = "query" | "header" | "path" | "cookie";

export interface ContractChange {
  id: string;
  type: string;
  severity: Severity;
  path: string;
  method?: string;
  description: string;
  before?: unknown;
  after?: unknown;
}

export interface AnalysisResult {
  summary: {
    totalChanges: number;
    breakingChanges: number;
    warnings: number;
    nonBreakingChanges: number;
  };
  changes: ContractChange[];
}

export interface NormalizedSchema {
  type?: string | string[];
  format?: string;
  enum?: unknown[];
  nullable?: boolean;
  required?: string[];
  properties?: Record<string, NormalizedSchema>;
  items?: NormalizedSchema;
  additionalProperties?: boolean | NormalizedSchema;
  /** Features present but not fully analyzed for compatibility. */
  unsupportedFeatures?: string[];
}

export interface NormalizedParameter {
  name: string;
  in: ParameterLocation;
  required: boolean;
  schema?: NormalizedSchema;
  description?: string;
}

export interface NormalizedMediaContent {
  contentTypes: string[];
  schema?: NormalizedSchema;
}

export interface NormalizedRequestBody {
  required: boolean;
  content: NormalizedMediaContent;
}

export interface NormalizedResponse {
  statusCode: string;
  description?: string;
  content: NormalizedMediaContent;
}

export interface NormalizedOperation {
  method: HttpMethod;
  operationId?: string;
  summary?: string;
  parameters: NormalizedParameter[];
  requestBody?: NormalizedRequestBody;
  responses: Record<string, NormalizedResponse>;
}

export interface NormalizedPathItem {
  path: string;
  operations: Partial<Record<HttpMethod, NormalizedOperation>>;
}

export interface NormalizedContract {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, NormalizedPathItem>;
  sourcePath?: string;
}

export class ContractScopeError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ContractScopeError";
    this.code = code;
    this.details = details;
  }
}

export const HTTP_METHODS: readonly HttpMethod[] = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;
