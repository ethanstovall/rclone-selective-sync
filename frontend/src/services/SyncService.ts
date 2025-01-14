import { RcloneAction, RcloneActionOutput } from "../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import { ExecuteRcloneAction } from "../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/syncservice";

export async function dryPushFolders(targetFolders: string[]): Promise<RcloneActionOutput[]> {
    const dryPushOutput = await ExecuteRcloneAction(targetFolders, RcloneAction.PUSH, true);
    return dryPushOutput;
}