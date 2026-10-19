export type ToolRisk = "low" | "medium" | "high" | "critical";

export type ToolScope =
    | "filesystem"
    | "terminal"
    | "screen_capture"
    | "application"
    | "system_settings"
    | "memory"
    | "network";

export interface ToolSpec {
    name: string;
    title: string;
    description: string;
    scope: ToolScope;
    risk: ToolRisk;
    destructive: boolean;
    parameters: {
        type: "object";
        properties: Record<string, { type: string; description: string }>;
        required: string[];
    };
}

export const TOOLS: ToolSpec[] = [
    {
        name: "read_file",
        title: "Read a file",
        description: "Read the contents of a text file on the user's computer.",
        scope: "filesystem",
        risk: "medium",
        destructive: false,
        parameters: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path of the file to read." },
            },
            required: ["path"],
        },
    },
    {
        name: "list_directory",
        title: "List a folder",
        description: "List the files and folders inside a directory.",
        scope: "filesystem",
        risk: "low",
        destructive: false,
        parameters: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path of the directory." },
            },
            required: ["path"],
        },
    },
    {
        name: "write_file",
        title: "Write a file",
        description: "Create or overwrite a text file with new contents.",
        scope: "filesystem",
        risk: "high",
        destructive: true,
        parameters: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path of the file to write." },
                content: { type: "string", description: "Full contents to write." },
            },
            required: ["path", "content"],
        },
    },
    {
        name: "run_command",
        title: "Run a shell command",
        description:
            "Run a shell command on the user's computer and return its output. Use only when no safer tool fits.",
        scope: "terminal",
        risk: "critical",
        destructive: true,
        parameters: {
            type: "object",
            properties: {
                command: { type: "string", description: "The shell command to run." },
            },
            required: ["command"],
        },
    },
    {
        name: "capture_screen",
        title: "Capture the screen",
        description:
            "Take a screenshot of the primary display to see what the user is looking at.",
        scope: "screen_capture",
        risk: "high",
        destructive: false,
        parameters: { type: "object", properties: {}, required: [] },
    },
    {
        name: "active_window",
        title: "Check the active window",
        description:
            "Get the title and application name of the window the user is currently focused on.",
        scope: "application",
        risk: "low",
        destructive: false,
        parameters: { type: "object", properties: {}, required: [] },
    },
    {
        name: "remember_fact",
        title: "Remember something",
        description:
            "Store a durable fact about the user so it is available in later conversations.",
        scope: "memory",
        risk: "low",
        destructive: false,
        parameters: {
            type: "object",
            properties: {
                content: { type: "string", description: "The fact to remember, in one sentence." },
            },
            required: ["content"],
        },
    },
    {
        name: "recall_facts",
        title: "Recall remembered facts",
        description: "List the facts previously remembered about the user.",
        scope: "memory",
        risk: "low",
        destructive: false,
        parameters: { type: "object", properties: {}, required: [] },
    },
    {
        name: "http_get",
        title: "Fetch a URL",
        description: "Fetch a public URL over HTTP and return the response body as text.",
        scope: "network",
        risk: "medium",
        destructive: false,
        parameters: {
            type: "object",
            properties: {
                url: { type: "string", description: "The https URL to fetch." },
            },
            required: ["url"],
        },
    },
];

export const TOOLS_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

export function toOpenAITools() {
    return TOOLS.map((tool) => ({
        type: "function" as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        },
    }));
}
