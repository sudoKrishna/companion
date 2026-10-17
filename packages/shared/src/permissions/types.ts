/**
 * wait i start writeing all this 
 * in the you know this is permision 
 * so screen capture
 * microphoen 
 * camera
 * write 
 * browser
 * appliaction 
 * system file
 * terminal 
 * system setting 
 * 
 * 
 * type permissionstatus
 * pending
 * success
 * error
 * expired
 * revoke 
 * 
 * type permissionrisk 
 * low high cretical 
 * 
 * permission request
 * id
 * converstaionid
 * toolcallid
 * title discrpto
 * reason 
 * risk
 * deccison
 * requestat
 * expresis
 * detailes
 * 
 * 
 * export permissionreason
 * requestid
 * decisisn approceo reject
 * deciedAt stirn
 * 
 */

export type PermissionScope = 
| "screen_capture"
| "microphone"
| "camera"
| "application" 
| "filesystem"
| "terminal"
| "system_settings";

export type PermissionDecision = 
| "pending"
| "approved"
| "rejected"
| "expired"
| "revoked"


export type PermissionRisk = "low" | "medium" | "high" | "critical";

export interface PermissionRequest {
    id : string;
    conversationId? :  string;
    toolCallId : string;
    scope : PermissionScope;
    title : string;
    description : string;
    risk : PermissionRisk;
    decision : PermissionDecision;
    requestAt : string;
    expiresAt? : string;
    details?: Record<string, unknown>;
}

export interface PermissionResponse {
    requestId :string;
    decision : "approved" | "rejected";
    decidedAt : string;
}









