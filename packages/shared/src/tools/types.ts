import { PermissionRisk, PermissionScope } from "../permissions/types";

export type ToolCategory = 
| "productivity" 
| "browser"
| "application"
| "filesystem"
| "terminal"
| "screen"
| "system"

export type ToolExecutionStatus = 
| "pending_approval"
| "approved"
| "rejected"
| "running"
| "succeded"
| "failed"
| "cancelled"
| "time_out"

export interface ToolDefinition<TInput = unknown> {
    name : string;
    description : string;
    category : ToolCategory;
    permissionScope : PermissionScope;
    risk : PermissionRisk;
    inputSchema : Record<string, unknown>
    destructive : boolean;
    inputExample? : TInput;
}

export interface toolCall<TInput = unknown> {
    id : string;
    conversationId : string;
    messageId : string;
    toolName : string;
    input : TInput;
    status : ToolExecutionStatus;
    createAt : string;
}

export interface ToolExecutionResult<TOutput = unknown> {
  id : string;
  status : "succeeded" | "falied" | "cancelled" | "timed_out"
  output?:  TOutput;
  error? : {
    code : string;
    message : string;
    retryable :string;
  };
   startedAt : string;
   finishedAt : string;
}

export interface ToolRegistryInput<TInput = unknown> {
definition : ToolDefinition<TInput>;
}

export interface ToolInvocationContext {
  conversationId : string;
  toolCallId : string;
  approvedPermissionRequestId : string;
}
























