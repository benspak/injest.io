export interface SlackWorkspace {
    id: string;
    workspace_id: string;
    workspace_name: string | null;
    domain: string | null;
    user_id: string;
    created_at: Date;
    updated_at: Date;
}
export interface CreateSlackWorkspaceInput {
    workspaceId: string;
    workspaceName?: string | null;
    domain?: string | null;
    userId: string;
}
export interface UpdateSlackWorkspaceInput {
    workspaceName?: string | null;
    domain?: string | null;
}
export declare class SlackWorkspaceModel {
    static findByWorkspaceId(workspaceId: string): Promise<SlackWorkspace | null>;
    static findByUserId(userId: string): Promise<SlackWorkspace[]>;
    static findById(id: string): Promise<SlackWorkspace | null>;
    static create(input: CreateSlackWorkspaceInput): Promise<SlackWorkspace>;
    static update(workspaceId: string, input: UpdateSlackWorkspaceInput): Promise<SlackWorkspace>;
    static createOrUpdate(input: CreateSlackWorkspaceInput): Promise<SlackWorkspace>;
    static delete(workspaceId: string): Promise<boolean>;
}
//# sourceMappingURL=SlackWorkspace.d.ts.map