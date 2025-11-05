export interface Comment {
    id: string;
    task_id: string;
    user_id: string;
    content: string;
    created_at: Date;
    updated_at: Date;
}
export interface CommentWithUser extends Comment {
    user_email: string;
}
export interface CreateCommentInput {
    task_id: string;
    user_id: string;
    content: string;
}
export declare class CommentModel {
    static create(input: CreateCommentInput): Promise<Comment>;
    static findById(id: string): Promise<Comment | null>;
    static findByTaskId(taskId: string): Promise<CommentWithUser[]>;
    static update(id: string, content: string): Promise<Comment>;
    static delete(id: string): Promise<boolean>;
    static verifyOwnership(commentId: string, userId: string): Promise<boolean>;
}
//# sourceMappingURL=Comment.d.ts.map