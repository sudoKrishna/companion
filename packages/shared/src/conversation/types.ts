/**
 * message role
 * message content
 * messageattactment
 * converstaion message
 * converstaion status
 * converstation 
 * createmessageinupt
 * converstaion error
 * 
 * converstaionmessage
 * id
 * converstaionid
 * role
 * content
 * create
 * update
 * attacment?
 * toolcallid
 * metadata
 * 
 */

export type MessageRole = "system" | "user" | "assistant" | "tool";

export type MessageContent = "text" | "audio" | "image";

export interface MessageAttactment {
    id : string;
    type : Exclude<MessageContent, "text">;
    mimeType : string;
    name? : string;
    url?:  string;
}

export interface ConverstaionMessage {
    id : string;
    conversationId : string;
    role : MessageRole;
    content : string;
    attachments? : MessageAttactment[];
    createdAt : string;
    updateAt : string;
    toolCallsIds? : string[];
    metadata? : Record<string, unknown>
}


// converstation status

export type ConversationStatus = 
| "idle"
| "listening"
| "thinking"
| "speaking"
| "waiting_for_approval"
| "error";


export interface Conversation {
    id : string;
    title : string;
    messages : ConverstaionMessage[];
    status : ConversationStatus;
    createAt: string;
    updateAt : string;
}

export interface ConversationMessageInput {
  conversationId : string;
  role : MessageRole;
  content : string;
  attachments?: MessageAttactment[]
}

export interface ConversationError {
    code : string;
    message : string;
    retryable : boolean
}


