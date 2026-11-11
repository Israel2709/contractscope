export type {
  AnalysisResult,
  ContractChange,
  HttpMethod,
  NormalizedContract,
  NormalizedOperation,
  NormalizedParameter,
  NormalizedPathItem,
  NormalizedRequestBody,
  NormalizedResponse,
  NormalizedSchema,
  ParameterLocation,
  Severity,
} from "./types/index.js";

export { ContractScopeError, HTTP_METHODS } from "./types/index.js";

export {
  parseContractFile,
  parseContractDocument,
  parseContractText,
  loadContractFile,
  parseContractContent,
  resolveLocalRefs,
  validateOpenApiDocument,
  splitJsonPointer,
  decodePointerToken,
  encodePointerToken,
} from "./parser/index.js";

export { normalizeContract, normalizeSchema } from "./normalizer/index.js";

export { compareContracts } from "./diff/index.js";

export { classifyChange, type ChangeType } from "./classifier/index.js";

export { formatTerminalReport, formatJsonReport } from "./reporter/index.js";

export { analyzeFiles, analyzeContracts, type AnalyzeOptions, type AnalyzeContractsOptions } from "./analyze.js";
