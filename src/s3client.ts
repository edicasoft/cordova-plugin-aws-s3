export interface S3Client {
    download(path: string): Promise<string>;

    read(path: string): Promise<string>;

    write(path: string, text: string): Promise<void>;

    upload(path: string, uri: string): Promise<void>;

    remove(path: string): Promise<void>;

    removeFiles(pathList: string[]): Promise<void>;

    removeDir(path: string): Promise<void>;

    copy(src: string, dst: string): Promise<void>;

    move(src: string, dst: string): Promise<void>;

    moveDir(src: string, dst: string): Promise<void>;

    list(path: string): Promise<Array<string>>;

    exists(path: string): Promise<boolean>;

    url(path: string, expiresInSeconds: number): Promise<string>;
}
