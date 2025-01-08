// @ts-check
// Cynhyrchwyd y ffeil hon yn awtomatig. PEIDIWCH Â MODIWL
// This file is automatically generated. DO NOT EDIT

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unused imports
import {Create as $Create} from "@wailsio/runtime";

export class FolderConfig {
    /**
     * Creates a new FolderConfig instance.
     * @param {Partial<FolderConfig>} [$$source = {}] - The source object to create the FolderConfig.
     */
    constructor($$source = {}) {
        if (!("remote_path" in $$source)) {
            /**
             * @member
             * @type {string}
             */
            this["remote_path"] = "";
        }
        if (!("local_path" in $$source)) {
            /**
             * @member
             * @type {string}
             */
            this["local_path"] = "";
        }

        Object.assign(this, $$source);
    }

    /**
     * Creates a new FolderConfig instance from a string or object.
     * @param {any} [$$source = {}]
     * @returns {FolderConfig}
     */
    static createFrom($$source = {}) {
        let $$parsedSource = typeof $$source === 'string' ? JSON.parse($$source) : $$source;
        return new FolderConfig(/** @type {Partial<FolderConfig>} */($$parsedSource));
    }
}

export class GlobalConfig {
    /**
     * Creates a new GlobalConfig instance.
     * @param {Partial<GlobalConfig>} [$$source = {}] - The source object to create the GlobalConfig.
     */
    constructor($$source = {}) {
        if (!("selected_project" in $$source)) {
            /**
             * @member
             * @type {string}
             */
            this["selected_project"] = "";
        }
        if (!("remotes" in $$source)) {
            /**
             * @member
             * @type {{ [_: string]: RemoteConfig }}
             */
            this["remotes"] = {};
        }

        Object.assign(this, $$source);
    }

    /**
     * Creates a new GlobalConfig instance from a string or object.
     * @param {any} [$$source = {}]
     * @returns {GlobalConfig}
     */
    static createFrom($$source = {}) {
        const $$createField1_0 = $$createType1;
        let $$parsedSource = typeof $$source === 'string' ? JSON.parse($$source) : $$source;
        if ("remotes" in $$parsedSource) {
            $$parsedSource["remotes"] = $$createField1_0($$parsedSource["remotes"]);
        }
        return new GlobalConfig(/** @type {Partial<GlobalConfig>} */($$parsedSource));
    }
}

export class ProjectConfig {
    /**
     * Creates a new ProjectConfig instance.
     * @param {Partial<ProjectConfig>} [$$source = {}] - The source object to create the ProjectConfig.
     */
    constructor($$source = {}) {
        if (!("allow_global_sync" in $$source)) {
            /**
             * @member
             * @type {boolean}
             */
            this["allow_global_sync"] = false;
        }
        if (!("folders" in $$source)) {
            /**
             * @member
             * @type {{ [_: string]: FolderConfig }}
             */
            this["folders"] = {};
        }

        Object.assign(this, $$source);
    }

    /**
     * Creates a new ProjectConfig instance from a string or object.
     * @param {any} [$$source = {}]
     * @returns {ProjectConfig}
     */
    static createFrom($$source = {}) {
        const $$createField1_0 = $$createType3;
        let $$parsedSource = typeof $$source === 'string' ? JSON.parse($$source) : $$source;
        if ("folders" in $$parsedSource) {
            $$parsedSource["folders"] = $$createField1_0($$parsedSource["folders"]);
        }
        return new ProjectConfig(/** @type {Partial<ProjectConfig>} */($$parsedSource));
    }
}

/**
 * @readonly
 * @enum {string}
 */
export const RcloneAction = {
    /**
     * The Go zero value for the underlying type of the enum.
     */
    $zero: "",

    PUSH: "PUSH",
    PULL: "PULL",
};

export class RemoteConfig {
    /**
     * Creates a new RemoteConfig instance.
     * @param {Partial<RemoteConfig>} [$$source = {}] - The source object to create the RemoteConfig.
     */
    constructor($$source = {}) {
        if (!("remote_name" in $$source)) {
            /**
             * @member
             * @type {string}
             */
            this["remote_name"] = "";
        }
        if (!("bucket_name" in $$source)) {
            /**
             * @member
             * @type {string}
             */
            this["bucket_name"] = "";
        }
        if (!("type" in $$source)) {
            /**
             * @member
             * @type {string}
             */
            this["type"] = "";
        }
        if (!("account" in $$source)) {
            /**
             * @member
             * @type {string}
             */
            this["account"] = "";
        }
        if (!("key" in $$source)) {
            /**
             * @member
             * @type {string}
             */
            this["key"] = "";
        }
        if (!("local_path" in $$source)) {
            /**
             * @member
             * @type {string}
             */
            this["local_path"] = "";
        }

        Object.assign(this, $$source);
    }

    /**
     * Creates a new RemoteConfig instance from a string or object.
     * @param {any} [$$source = {}]
     * @returns {RemoteConfig}
     */
    static createFrom($$source = {}) {
        let $$parsedSource = typeof $$source === 'string' ? JSON.parse($$source) : $$source;
        return new RemoteConfig(/** @type {Partial<RemoteConfig>} */($$parsedSource));
    }
}

// Private type creation functions
const $$createType0 = RemoteConfig.createFrom;
const $$createType1 = $Create.Map($Create.Any, $$createType0);
const $$createType2 = FolderConfig.createFrom;
const $$createType3 = $Create.Map($Create.Any, $$createType2);
