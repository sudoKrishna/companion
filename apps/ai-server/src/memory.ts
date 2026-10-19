import { db } from "./db";

export interface Fact {
    id: string;
    content: string;
    createdAt: string;
}

export interface StoredMessage {
    id: string;
    conversationId: string;
    role: string;
    content: string;
    createdAt: string;
}

function serializeFact(row: { id: string; content: string; createdAt: Date }): Fact {
    return { id: row.id, content: row.content, createdAt: row.createdAt.toISOString() };
}

function serializeMessage(row: {
    id: string;
    conversationId: string;
    role: string;
    content: string;
    createdAt: Date;
}): StoredMessage {
    return {
        id: row.id,
        conversationId: row.conversationId,
        role: row.role,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
    };
}

export async function addFact(content: string): Promise<Fact> {
    const row = await db.fact.create({ data: { content: content.trim() } });
    return serializeFact(row);
}

export async function listFacts(limit = 100): Promise<Fact[]> {
    const rows = await db.fact.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return rows.map(serializeFact);
}

export async function deleteFact(id: string): Promise<boolean> {
    const { count } = await db.fact.deleteMany({ where: { id } });
    return count > 0;
}

export async function addMessage(
    conversationId: string,
    role: string,
    content: string,
): Promise<StoredMessage> {
    const row = await db.message.create({ data: { conversationId, role, content } });
    return serializeMessage(row);
}

export async function listMessages(conversationId: string, limit = 200): Promise<StoredMessage[]> {
    const rows = await db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        take: limit,
    });
    return rows.map(serializeMessage);
}

export async function listConversations(limit = 20) {
    const rows = await db.message.groupBy({
        by: ["conversationId"],
        _count: { _all: true },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: "desc" } },
        take: limit,
    });

    return Promise.all(
        rows.map(async (row) => {
            const firstUserMessage = await db.message.findFirst({
                where: { conversationId: row.conversationId, role: "user" },
                orderBy: { createdAt: "asc" },
            });

            return {
                id: row.conversationId,
                messageCount: row._count._all,
                firstMessage: firstUserMessage?.content ?? null,
                lastMessageAt: row._max.createdAt?.toISOString() ?? null,
            };
        }),
    );
}

export async function recordToolDecision(toolName: string, input: unknown, decision: string) {
    await db.toolAudit.create({
        data: { toolName, input: JSON.stringify(input ?? {}), decision },
    });
}

export async function listToolAudit(limit = 50) {
    const rows = await db.toolAudit.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}
