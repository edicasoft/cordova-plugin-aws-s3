import _ from "lodash";
import { Logger } from "log4ts";
import { SafeUrl, DomSanitizer } from "@angular/platform-browser";
import { Storage } from "@ionic/storage";

import { S3Client } from "./s3client";

const logger = new Logger("S3Image");

export class CachedImage {
    private loading = true;
    private _url: SafeUrl;

    constructor(
        private s3: S3Client,
        private local: Storage,
        private sanitizer: DomSanitizer,
        private _pathList: string[],
        refreshRate: number) {
        this.refresh(refreshRate).then(() => this.loading = false);
    }

    get isLoading(): boolean {
        return this.loading;
    }

    get listPath(): string[] {
        return _.map(this._pathList, (a) => a);
    }

    private async load(path: string): Promise<SafeUrl> {
        try {
            return await this.getUrl(path);
        } catch (ex) {
            logger.warn(() => `Failed to load s3image: ${path}: ${ex}`);
        }
        return null;
    }

    private async refresh(limit: number) {
        try {
            let url;
            let i = 0;
            while (_.isNil(url) && i < this._pathList.length) {
                url = await this.load(this._pathList[i++]);
            }
            this._url = url;
        } finally {
            setTimeout(() => {
                this.refresh(limit);
            }, limit);
        }
    }

    isSamePath(pathList: string[]): boolean {
        return _.isEmpty(_.difference(this._pathList, pathList));
    }

    get url(): SafeUrl {
        return this._url;
    }

    private async getUrl(s3path: string): Promise<SafeUrl> {
        const url = await this.getCached(s3path);
        return _.isNil(url) ? null : this.sanitizer.bypassSecurityTrustUrl(url);
    }

    private async getCached(s3path: string): Promise<string | null> {
        try {
            if (await this.s3.exists(s3path)) {
                try {
                    const data = await this.local.get(s3path);
                    if (!_.isNil(data) && await this.checkUrl(data)) {
                        return data;
                    }
                } catch (ex) {
                    logger.info(() => `Failed to get local data: ${s3path}: ${ex}`);
                }
                const blob = await this.s3.download(s3path);
                const url = URL.createObjectURL(blob);
                this.local.set(s3path, url);
                return url;
            } else {
                logger.info(() => `No data on s3: ${s3path}, removing local cache...`);
                this.local.remove(s3path).then(
                    (ok) => logger.info(() => `Removed local data: ${s3path}`),
                    (error) => logger.warn(() => `Error on removing local data: ${s3path}`)
                );
            }
        } catch (ex) {
            logger.warn(() => `Failed to get url: ${s3path}`);
        }
        return null;
    }

    private async checkUrl(url: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            let http = new XMLHttpRequest();
            http.onload = () => {
                resolve(_.floor(http.status / 100) == 2);
            };
            http.onerror = () => {
                logger.warn(() => `No data on ${url}`);
                resolve(false);
            };
            http.open('GET', url);
            http.send();
        });
    }
}
