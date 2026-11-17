import { z } from "zod";

export type ErrorCode =
  | "INVALID_REQUEST"
  | "UNKNOWN_ADDON"
  | "RESOLUTION_ERROR"
  | "TEMPLATE_ERROR"
  | "SECURITY_ERROR"
  | "LIMIT_EXCEEDED"
  | "ZIP_ERROR"
  | "IO_ERROR"
  | "INTERNAL_ERROR";

export interface IssueDetail {
  path: string;
  message: string;
}

/**
 * Typed, user-presentable error. Code is stable and safe to branch on;
 * message is written for humans and never contains stack traces or absolute paths.
 */
export class LaunchbedError extends Error {
  readonly code: ErrorCode;
  readonly issues: IssueDetail[];

  constructor(code: ErrorCode, message: string, issues: IssueDetail[] = []) {
    super(message);
    this.name = "LaunchbedError";
    this.code = code;
    this.issues = issues;
  }

  toJSON(): { error: { code: ErrorCode; message: string; issues: IssueDetail[] } } {
    return { error: { code: this.code, message: this.message, issues: this.issues } };
  }
}

export function issuesFromZod(error: z.ZodError): IssueDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.map(String).join(".") : "(root)",
    message: issue.message,
  }));
}

export function toErrorPayload(error: unknown): {
  error: { code: ErrorCode; message: string; issues: IssueDetail[] };
} {
  if (error instanceof LaunchbedError) {
    return error.toJSON();
  }
  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected error while processing the request.",
      issues: [],
    },
  };
}
