export declare function extractPdfText(buffer: Buffer): Promise<{
    text: string;
    totalPages: number;
}>;
export declare function extractPdfTextByPage(buffer: Buffer): Promise<{
    numPages: number;
    pageTexts: string[];
    totalChars: number;
}>;
export declare const INVALID_FILENAME_ERROR_MESSAGE = "Error: Invalid filename format. Must be alphanumeric with supported extension.";
export declare const DEFAULT_FILE_SYSTEM_PATH = "browseruse_agent_data";
export declare class FileSystemError extends Error {
}
declare abstract class BaseFile {
    name: string;
    protected content: string;
    constructor(name: string, content?: string);
    abstract get extension(): string;
    get fullName(): string;
    get size(): number;
    get lineCount(): number;
    protected writeFileContent(content: string): void;
    protected appendFileContent(content: string): void;
    read(): string;
    syncToDisk(dir: string): Promise<void>;
    syncToDiskSync(dir: string): void;
    write(content: string, dir: string): Promise<void>;
    writeSync(content: string, dir: string): void;
    append(content: string, dir: string): Promise<void>;
    appendSync(content: string, dir: string): void;
    toJSON(): {
        name: string;
        content: string;
    };
}
export interface FileState {
    type: string;
    data: {
        name: string;
        content: string;
    };
}
export interface FileSystemState {
    files: Record<string, FileState>;
    base_dir: string;
    extracted_content_count: number;
}
export declare class FileSystem {
    private files;
    private readonly defaultFiles;
    private readonly baseDir;
    readonly dataDir: string;
    extractedContentCount: number;
    constructor(baseDir: string, createDefaultFiles?: boolean);
    private createDefaultFiles;
    private isValidFilename;
    static sanitize_filename(fileName: string): string;
    private resolveFilename;
    private parseFilename;
    private getFileClass;
    private instantiateFile;
    get_allowed_extensions(): string[];
    get_dir(): string;
    get_file(filename: string): BaseFile | null;
    list_files(): string[];
    display_file(filename: string): string | null;
    read_file_structured(filename: string, externalFile?: boolean): Promise<{
        message: string;
        images: Array<{
            name: string;
            data: string;
        }> | null;
    }>;
    read_file(filename: string, externalFile?: boolean): Promise<string>;
    write_file(filename: string, content: string): Promise<string>;
    append_file(filename: string, content: string): Promise<string>;
    replace_file_str(filename: string, oldStr: string, newStr: string): Promise<string>;
    save_extracted_content(content: string): Promise<string>;
    describe(): string;
    get_todo_contents(): string;
    get_state(): FileSystemState;
    nuke(): Promise<void>;
    static from_state_sync(state: FileSystemState): FileSystem;
    static from_state(state: FileSystemState): Promise<FileSystem>;
}
export {};
