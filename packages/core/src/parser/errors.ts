import { ContractScopeError } from "../types/index.js";

export function parseError(message: string, details?: unknown): ContractScopeError {
  return new ContractScopeError("PARSE_ERROR", message, details);
}

export function validationError(message: string, details?: unknown): ContractScopeError {
  return new ContractScopeError("VALIDATION_ERROR", message, details);
}

export function refError(message: string, details?: unknown): ContractScopeError {
  return new ContractScopeError("REF_ERROR", message, details);
}
