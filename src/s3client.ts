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
export class S3Client {
    constructor(private local: Storage, private sanitizer: DomSanitizer) {
        const plugin = (window as any).plugin;
        function isDef(typedec) {
            return !_.isEqual(typedec, 'undefined');
        }
        const hasPlugin = isDef(typeof plugin) && isDef(typeof plugin.AWS) && isDef(typeof plugin.AWS.S3);

        this.plugin = hasPlugin ? plugin.AWS.S3 : new S3WebClient();
    }

    private readonly plugin: S3Plugin;

    createCachedImage(path: string, refreshRate = 1000 * 60 * 10): CachedImage {
        return this.createCachedImageOfList([path], refreshRate);
    }
    createCachedImageOfList(pathList: string[], refreshRate = 1000 * 60 * 10): CachedImage {
        return new CachedImage(this, this.local, this.sanitizer, pathList, refreshRate);
    }

    async download(path: string): Promise<URL> {
        const url = await this.plugin.download(path);
        return new URL(url);
    }

    async read(path: string): Promise<string> {
        return this.plugin.read(path);
    }

    async write(path: string, text: string): Promise<void> {
        return this.plugin.write(path, text);
    }

    async upload(path: string, url: URL): Promise<void> {
        return this.plugin.upload(path, url.href);
    }

    async remove(path: string): Promise<void> {
        return this.plugin.remove(path);
    }

    async removeFiles(pathList: string[]): Promise<void> {
        return this.plugin.removeFiles(pathList);
    }

    async removeDir(path: string): Promise<void> {
        return this.plugin.removeDir(path);
    }

    async copy(src: string, dst: string): Promise<void> {
        return this.plugin.copy(src, dst);
    }

    async move(src: string, dst: string): Promise<void> {
        return this.plugin.move(src, dst);
    }

    async moveDir(src: string, dst: string): Promise<void> {
        return this.plugin.moveDir(src, dst);
    }

    async list(path: string): Promise<Array<string>> {
        return this.plugin.list(path);
    }

    async exists(path: string): Promise<boolean> {
        return this.plugin.exists(path);
    }

    async url(path: string, expiresInSeconds: number): Promise<string> {
        return this.plugin.url(path, expiresInSeconds);
    }
}
