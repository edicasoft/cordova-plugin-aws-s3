import _ from "lodash";
import { Logger } from "log4ts";

import { S3Client } from "./s3client";
import { S3WebClient } from "./s3_web_client";

const plugin = (window as any).plugin;

const logger = new Logger("S3File");

function isDef(typedec) {
    return !_.isEqual(typedec, 'undefined');
}
const hasPlugin() = isDef(typeof plugin) && isDef(typeof plugin.AWS) && isDef(typeof plugin.AWS.S3);

export class S3File implements S3Client {
    constructor() {
        this.client = hasPlugin ? plugin.AWS.S3 : new S3WebClient();
    }

    private client: S3Client;

    async download(path: string): Promise<Blob> {
        return this.client.download(path);
    }

    async read(path: string): Promise<string> {
        return this.client.read(path);
    }

    async write(path: string, text: string): Promise<void> {
        return this.client.write(path, text);
    }

    async upload(path: string, blob: Blob): Promise<void> {
        return this.client.upload(path, blob);
    }

    async remove(path: string): Promise<void> {
        return this.client.remove(path);
    }

    async removeFiles(pathList: string[]): Promise<void> {
        return this.client.removeFiles(pathList);
    }

    async removeDir(path: string): Promise<void> {
        return this.client.removeDir(path);
    }

    async copy(src: string, dst: string): Promise<void> {
        return this.client.copy(src, dst);
    }

    async move(src: string, dst: string): Promise<void> {
        return this.client.move(src, dst);
    }

    async moveDir(src: string, dst: string): Promise<void> {
        return this.client.moveDir(src, dst);
    }

    async list(path: string): Promise<Array<string>> {
        return this.client.list(path);
    }

    async exists(path: string): Promise<boolean> {
        return this.client.exists(path);
    }

    async url(path: string, expiresInSeconds: number): Promise<string> {
        return this.client.url(path, expiresInSeconds);
    }
}
