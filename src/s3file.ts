import _ from "lodash";
import { Injectable } from '@angular/core';
import { DomSanitizer } from "@angular/platform-browser";
import { Storage } from "@ionic/storage";
import { Logger } from "log4ts";

import { S3Plugin } from "./s3plugin";
import { S3WebClient } from "./s3_web_client";
import { CachedImage } from "./s3image";

const logger = new Logger("S3File");

@Injectable()
export class S3File {
    constructor(private local: Storage, private sanitizer: DomSanitizer) {
        const plugin = (window as any).plugin;
        function isDef(typedec) {
            return !_.isEqual(typedec, 'undefined');
        }
        const hasPlugin = isDef(typeof plugin) && isDef(typeof plugin.AWS) && isDef(typeof plugin.AWS.S3);

        this.client = hasPlugin ? plugin.AWS.S3 : new S3WebClient();
    }

    private readonly client: S3Plugin;

    createCachedImage(path: string, refreshRate = 1000 * 60 * 10): CachedImage {
        return this.createCachedImageOfList([path], refreshRate);
    }
    createCachedImageOfList(pathList: string[], refreshRate = 1000 * 60 * 10): CachedImage {
        return new CachedImage(this, this.local, this.sanitizer, pathList, refreshRate);
    }

    async download(path: string): Promise<URL> {
        const url = await this.client.download(path);
        return new URL(url);
    }

    async read(path: string): Promise<string> {
        return this.client.read(path);
    }

    async write(path: string, text: string): Promise<void> {
        return this.client.write(path, text);
    }

    async upload(path: string, url: URL): Promise<void> {
        return this.client.upload(path, url.href);
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
