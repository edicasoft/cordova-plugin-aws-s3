import _ from "lodash";
import { SafeUrl, DomSanitizer } from "@angular/platform-browser";
import { Storage } from "@ionic/storage";

import { S3File } from "./s3file";

export class S3Image {
    constructor(public s3: S3File, private local: Storage, private sanitizer: DomSanitizer) { }

    async getUrl(s3path: string): Promise<SafeUrl> {
        assert("Caching S3 path", s3path);
        const url = await this.getCached(s3path);
        return _.isNil(url) ? null : this.sanitizer.bypassSecurityTrustUrl(url);
    }

    private async getCached(s3path: string): Promise<string> {
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

    createCache(pathList: string[], refreshRate = 1000 * 60 * 10): CachedImage {
        return new CachedImage(this, pathList, refreshRate);
    }
}

export class CachedImage {
    private loading = true;
    private _url: SafeUrl;

    constructor(private s3image: S3Image, private _pathList: string[], refreshRate: number) {
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
            return await this.s3image.getUrl(path);
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
}
