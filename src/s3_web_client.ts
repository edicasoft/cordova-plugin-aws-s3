import _ from "lodash";
import { Logger } from "log4ts";

import { S3Client } from "./s3client";

declare var AWS_S3_BUCKET_NAME;

const logger = new Logger("S3WebClient");

export class S3WebClient implements S3Client {
    constructor() {
        this.client = cognito.identity.then((x) => new AWS.S3());
    }

    private client: Promise<S3>;

    private async invoke<R>(proc: (s3client) => AWSRequest): Promise<R> {
        return requestToPromise<R>(proc(await this.client));
    }

    private async load(path: string): Promise<{Body: number[]}> {
        logger.debug(() => `Reading file: ${AWS_S3_BUCKET_NAME}:${path}`);
        return await this.invoke<{ Body: number[] }>((s3) => s3.getObject({
            Bucket: AWS_S3_BUCKET_NAME,
            Key: path
        }));
    }

    async download(path: string, type: string = "image/jpeg"): Promise<Blob> {
        const res = await this.load(path);
        return new Blob([res.Body], { type: type });
    }

    async read(path: string): Promise<string> {
        const res = await this.load(path);
        return String.fromCharCode.apply(null, res.Body);
    }

    async write(path: string, text: string): Promise<void> {
        const bucketName = await this.settings.s3Bucket;
        logger.debug(() => `Write file: ${bucketName}:${path}`);
        await this.invoke((s3) => s3.putObject({
            Bucket: bucketName,
            Key: path,
            Body: text
        }));
    }

    async upload(path: string, blob: Blob): Promise<void> {
        const bucketName = await this.settings.s3Bucket;
        logger.debug(() => `Uploading file: ${bucketName}:${path}`);
        await this.invoke((s3) => s3.putObject({
            Bucket: bucketName,
            Key: path,
            Body: blob,
            ContentType: blob.type
        }));
    }

    async remove(path: string): Promise<void> {
        const bucketName = await this.settings.s3Bucket;
        logger.debug(() => `Removing file: ${bucketName}:${path}`);
        await this.invoke((s3) => s3.deleteObject({
            Bucket: bucketName,
            Key: path
        }));
    }

    async removeFiles(pathList: string[]): Promise<void> {
        const bucketName = await this.settings.s3Bucket;
        logger.debug(() => `Removing files in bucket[${bucketName}]: ${JSON.stringify(pathList, null, 4)}`);
        const lists = _.chunk(pathList, 1000);
        await Promise.all(_.map(lists, (list) =>
            this.invoke((s3) => s3.deleteObjects({
                Bucket: bucketName,
                Delete: {
                    Objects: _.map(list, (path) => {
                        return {
                            Key: path
                        }
                    })
                }
            }))
        ));
    }

    async removeDir(path: string): Promise<void> {
        const bucketName = await this.settings.s3Bucket;
        logger.debug(() => `Removing dir: ${bucketName}:${path}`);
        const dir = `${path}/`;
        const list = await this.list(dir);
        this.removeFiles(list);
    }

    async copy(src: string, dst: string): Promise<void> {
        const bucketName = await this.settings.s3Bucket;
        logger.debug(() => `Copying file: ${bucketName}:${src}=>${dst}`);
        await this.invoke((s3) => s3.copyObject({
            Bucket: bucketName,
            CopySource: `${bucketName}/${src}`,
            Key: dst
        }));
    }

    async move(src: string, dst: string): Promise<void> {
        await this.copy(src, dst);
        await this.remove(src);
    }

    async moveDir(src: string, dst: string): Promise<void> {
        const files = _.filter(await this.list(`${src}/`), (path) => {
            return !path.endsWith("/");
        });
        await Promise.all(_.map(files, (srcPath) => {
            const dstPath = srcPath.replace(src, dst);
            return this.move(srcPath, dstPath);
        }));
        await this.removeDir(src);
    }

    async list(path: string): Promise<Array<string>> {
        const bucketName = await this.settings.s3Bucket;
        const res = await this.invoke<{ Contents: { Key: string }[] }>((s3) => s3.listObjects({
            Bucket: bucketName,
            Prefix: path
        }));
        return res.Contents.map((x) => x.Key);
    }

    async exists(path: string): Promise<boolean> {
        const bucketName = await this.settings.s3Bucket;
        logger.debug(() => `Checking exists: ${bucketName}:${path}`);
        try {
            const res = await this.invoke<{ ContentLength: number }>((s3) => s3.headObject({
                Bucket: bucketName,
                Key: path
            }));
            return !_.isNil(res);
        } catch (ex) {
            logger.warn(() => `Error on checking exists: ${bucketName}:${path}: ${ex}`);
            return false;
        }
    }

    async url(path: string, expiresInSeconds: number): Promise<string> {
        const s3: any = await this.client;
        const bucketName = await this.settings.s3Bucket;
        logger.debug(() => `Getting url of file: ${bucketName}:${path}`);
        try {
            return s3.getSignedUrl("getObject", {
                Bucket: bucketName,
                Key: path,
                Expires: expiresInSeconds
            });
        } catch (ex) {
            logger.warn(() => `Error on getting url: ${ex}`);
        }
    }
}
