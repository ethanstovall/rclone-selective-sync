# Feature: Cloud Render Farm Addon

## Status: Backburner

This feature is a longer-term exploration. The core app (sync, bisync, task queue) and embedded rclone migration take priority. Phase 1 is worth attempting as a proof-of-concept to validate cost and complexity before committing further. Before moving to Phase 2, do a real cost comparison against managed services (RenderStreet, RebusFarm, SheepIt).

## Summary

Extend the existing rclone-based Wails UI app (which manages VFX project backups on Backblaze B2, organized by scene folders) with a cloud render farm capability. Users select a scene folder and Blender file(s), configure frame ranges and parallelism, and the app orchestrates EC2 spot instances to render frames and return results — all integrated with the existing B2 storage and rclone infrastructure.

## Motivation

- Local rendering ties up the workstation and is bottlenecked by a single GPU.
- Upgrading to a high-end local GPU (e.g. RTX 5090) is currently impractical due to market pricing ($3,000–$5,000+ street price in 2026).
- Cloud rendering on EC2 spot instances offers on-demand parallelism at ~$0.25–0.40/hr per GPU instance (g6.xlarge with NVIDIA L4).
- The existing app already manages scene folder structure and rclone remotes on B2, making it a natural integration point.

## Equivalent Managed Services (for context)

These are the established alternatives. Understanding their strengths ensures the custom solution doesn't regress on solved problems — and helps determine whether this feature is worth building at all.

| Service | Model | Approx. Cost | Key Strength |
|---|---|---|---|
| RebusFarm | Per-GHzh/OBh, plugin-based | 1.41¢/GHzh CPU, 0.53¢/OBh GPU | Blender plugin with automatic asset validation, volume discounts up to 60% |
| GarageFarm | Tiered priority pricing | Varies by priority tier | 33% Blender discount, automated scene checking, broad engine support |
| RenderStreet | Flat monthly ($59.97 unlimited) or on-demand | $59.97/mo unlimited | Best value for frequent rendering, Blender-dedicated since 2012 |
| SheepIt | Free (peer-to-peer) | Free | Zero cost, community-powered, Blender-only |
| iRender | IaaS GPU rental | $9+/hr per node (RTX 4090) | Full remote desktop, install anything, multi-GPU nodes |
| Blendergrid | Per-job with dynamic quoting | Varies | Blender-specific, upfront price quotes, Cycles-focused |

### Honest cost comparison

- **RenderStreet at $60/mo unlimited** is extremely hard to beat for frequent rendering. A few hours of spot instances would cost the same.
- **SheepIt is free.** If queue times are tolerable, the cost comparison is unwinnable.
- **RebusFarm/GarageFarm** handle all the hard problems (asset packing, path remapping, Blender versioning) out of the box.

**Where the custom approach wins:** full control, no third-party asset upload (assets stay on your B2), tight integration with the existing folder structure, and no per-frame markup. Best suited for infrequent but large burst renders, or for users who cannot share assets with third-party services.

### What managed services handle that this feature must also address

- **Asset dependency resolution**: Textures, HDRIs, linked .blend libraries, fonts — anything not packed into the .blend file.
- **Path remapping**: Absolute paths baked into .blend files (e.g. `C:\Users\...`) won't resolve on a Linux EC2 instance.
- **Blender version matching**: The render node must run the exact Blender version the project was authored in.
- **Failed frame retry**: Spot instances can be interrupted; individual frames can crash.
- **Progress reporting**: Users need visibility into which frames are done, failed, or in-progress.

## Dependencies

### Embedded Rclone (FEATURE_EMBEDDED_RCLONE)

**Soft dependency.** Not strictly required but strongly recommended before starting this feature.

- **With librclone (recommended):** Both the desktop app and the `cmd/worker` binary compile the same rclone version from `pkg/sync`. Zero version drift, no rclone installation needed on the EC2 AMI. This is the architecture the design assumes.
- **Without librclone (fallback):** The worker binary shells out to rclone, which must be installed on the AMI separately. This works for Phase 1 prototyping but introduces version drift between the desktop app's rclone and the worker's rclone. Not recommended for production.

### Bisync (FEATURE_BISYNC)

**No dependency.** The render worker only needs one-way sync (pull scene folder down, push rendered frames up). Bisync is irrelevant here.

## Architecture

### Shared Go Package (core design decision)

The rclone sync logic should be extracted into a shared Go package that both the Wails UI app and a headless worker CLI binary import. This avoids shipping the full Wails/UI runtime to EC2 and eliminates version drift between desktop and cloud sync behavior.

```
pkg/
  sync/           # Shared rclone sync logic (Go library)
  renderjob/      # Job definition, frame splitting, status tracking

cmd/
  app/            # Wails UI app (imports pkg/sync, pkg/renderjob)
  worker/         # Headless CLI binary for EC2 (imports pkg/sync)
```

Rationale: Building CLI functionality directly into the Wails app is possible but would ship unnecessary UI dependencies to headless instances. A shared package with two thin entry points is cleaner.

### If using rclone as a Go library

The app currently shells out to rclone via exec commands. The embedded rclone feature (FEATURE_EMBEDDED_RCLONE) plans to replace this with librclone. If/when this happens:

- The `pkg/sync` package wraps the rclone Go library directly.
- The `cmd/worker` binary compiles the same rclone version in.
- The worker binary is baked into the AMI, pinning the rclone version to whatever was compiled.
- No rclone installation is needed on the EC2 instance at all.

### Pre-baked AMI

An AMI should be maintained with:

- Blender (headless, specific version)
- The `worker` CLI binary
- NVIDIA drivers and CUDA toolkit (for GPU rendering)
- No credentials or remote configs baked in (pulled at boot from Secrets Manager)

AMI rebuild should be automated (e.g. via Packer) and triggered when Blender or the worker binary is updated.

### Secrets and Configuration

- Rclone remote secrets (B2 credentials) stored in **AWS Secrets Manager**.
- EC2 instances pull secrets at boot via instance role + IAM policy (no keys on disk).
- Scene folder path, frame range, and output destination passed via **EC2 user data** or **SSM parameters**.

## Render Flow

```
User's Wails App                        AWS
┌─────────────────┐
│ Select scene     │
│ Select .blend    │
│ Set frame range  │
│ Set parallelism  │
│ Choose output    │
│   destination    │
└───────┬─────────┘
        │
        ▼
┌─────────────────┐     ┌─────────────────────────────────┐
│ Split frames     │     │  EC2 Spot Instance (x N)        │
│ across N         │────▶│  1. Boot from pre-baked AMI      │
│ instances        │     │  2. Pull secrets from SM          │
│                  │     │  3. worker sync <scene-folder>    │
│ Launch N spot    │     │  4. blender -b file.blend         │
│ instances via    │     │     --render-output /tmp/out/     │
│ launch template  │     │     -f <start>..<end>             │
│                  │     │  5. worker upload /tmp/out/ <dest> │
│ Poll/monitor     │     │  6. Self-terminate                │
│ status           │     └─────────────────────────────────┘
└─────────────────┘
```

### Output Destination Options

- **Same B2 remote**: Upload rendered frames back to a `renders/` subfolder within the scene folder on B2. Keeps everything co-located with the project.
- **S3 bucket**: Upload to a dedicated S3 bucket for faster access from AWS or for further pipeline processing.
- **Either/configurable**: Let the user choose per job.

## UI: Render Modal Window

Within the existing Wails app, a modal or panel that provides:

1. **Scene folder selector** — dropdown/browser populated from the existing B2 folder structure.
2. **Blender file selector** — list `.blend` files found in the selected scene folder.
3. **Frame range** — start frame, end frame (auto-detected from .blend if possible).
4. **Instance count** — number of parallel EC2 instances (with cost estimate).
5. **Instance type selector** — e.g. g6.xlarge (L4 GPU), g4dn.xlarge (T4 GPU, cheaper).
6. **Output destination** — B2 scene folder or S3 bucket.
7. **Kick off / Monitor** — launch button, then progress view showing per-instance status and frame completion.

## Key Considerations

### Cost Control

- **Spot instances only** (with on-demand fallback option). Spot g6.xlarge is ~60-70% cheaper than on-demand.
- **Auto-termination is critical.** The worker script must terminate the instance on completion AND on failure. A stuck instance at $0.80/hr burns $19.20/day.
- **Billing safety**: Consider a Lambda or CloudWatch alarm that terminates any render instance running longer than a configurable max duration (e.g. 4 hours).
- **Cost estimation**: Before launching, estimate cost based on instance type, count, and expected render time (can be refined over time with historical data).

### Spot Interruption Handling

- EC2 spot instances can be reclaimed with 2 minutes notice.
- The worker should listen for the spot interruption notice and upload any completed frames before termination.
- The app should detect incomplete jobs and offer to re-launch for remaining frames only.

### Asset Dependency / Path Issues

The app's existing full-folder sync is actually the biggest advantage here over managed services. Since the entire scene folder is synced from B2 to the worker, **relative paths within the folder resolve naturally**. This handles most dependency cases:

- Textures and HDRIs referenced with relative paths — work automatically.
- Linked .blend libraries within the same scene folder — work automatically.
- Image sequences used as textures — work automatically if within the scene folder.
- Alembic caches and VDB volumes — work automatically if within the scene folder.

**What still breaks:**
- **Absolute paths** baked into .blend files (e.g. `C:\Users\...`) won't resolve on Linux. Mitigation: preflight scan using `blender --python-expr` to detect absolute paths and warn the user.
- **External assets outside the scene folder** (e.g. a shared asset library in a different folder). Mitigation: document the limitation clearly. Users can either pack these into the .blend or restructure to keep everything within the scene folder.
- **Fonts**: System fonts won't be available on the render node. Mitigation: recommend packing fonts into the .blend, or include common fonts in the AMI.

**Recommendation**: Lean into the full-folder sync as the primary asset strategy. Add a preflight check that scans the .blend for absolute paths and external references as a warning, not a blocker.

### Blender Version Management

- The AMI pins a specific Blender version.
- If the user's project uses a different version, the app should warn or maintain multiple AMIs tagged by Blender version.
- Blender minor version mismatches (e.g. 5.0.1 vs 5.1) can introduce breaking changes (e.g. Grease Pencil fill revamp in 5.1, Python 3.13 upgrade). The version match should be exact or at least major.minor.

### Monitoring and Status

Tiered approach by phase:

- **Phase 1 (minimal):** Worker streams stdout to **CloudWatch Logs** via the CloudWatch agent. Free, real-time, no custom infrastructure. The app can tail logs via the AWS SDK.
- **Phase 2 (structured):** Worker writes frame status to a **DynamoDB table** (taskId, instanceId, frame, status, timestamp). The app polls the table for a live progress view. Fast reads, cheap, queryable.
- **Phase 3 (real-time push):** WebSocket via **API Gateway** for real-time frame completion events pushed to the UI. Eliminates polling latency.

On completion, a summary manifest lists all rendered frames and any failures.

### Security

- EC2 instances run in a private VPC with egress to B2/S3 only.
- IAM instance role scoped to: Secrets Manager read (specific secret ARN), S3 write (specific bucket/prefix), EC2 self-terminate.
- No long-lived credentials on disk.
- B2 credentials are short-lived or scoped to the specific bucket.

### Network / Data Transfer

- **B2 egress**: Backblaze B2 has free egress through the Bandwidth Alliance (with Cloudflare) or up to 3x storage in free egress/month. For large scene folders this matters.
- **EC2 ingress**: Free.
- **EC2 to B2 upload (rendered frames)**: Standard B2 API upload costs, generally negligible.
- **EC2 to S3**: Free within the same region.

## Implementation Phases

### Phase 1: Core Worker + Manual Launch (proof-of-concept)

- Extract `pkg/sync` from existing app.
- Build `cmd/worker` CLI binary.
- Create base AMI with Blender + worker binary + NVIDIA drivers.
- Manual testing: launch an instance, pass it a scene folder path, verify it renders and uploads.
- CloudWatch Logs for monitoring.
- **Gate**: After Phase 1, do a real cost/complexity comparison against RenderStreet and RebusFarm. Only proceed if the custom approach is justified.

### Phase 2: App Integration

- Add render modal UI to Wails app.
- Implement frame splitting logic.
- Implement EC2 launch (via AWS SDK for Go) from the app.
- DynamoDB-based frame status tracking.
- Basic progress view in the UI.

### Phase 3: Reliability + Polish

- Spot interruption handling.
- Failed frame detection and re-launch.
- Cost estimation in the UI.
- Max-duration safety alarm.
- Preflight .blend asset/path checks.

### Phase 4: Optimization (future)

- AMI auto-rebuild pipeline (Packer + CI).
- Multiple Blender version AMIs.
- Historical render time data for better cost estimates.
- WebSocket real-time status instead of polling.
- After Effects support (Windows instances, `aerender`).

## Resolved Questions

- **SQS job queue?** Skip it. Direct EC2 launch per job is simpler. SQS adds complexity that isn't needed unless running dozens of concurrent jobs.
- **Cloud compositing?** Leave rendered frames as image sequences. Compositing is fast locally and users want control over the final output.
- **AMI management?** Separate manual/CI process initially (Packer script). App-managed AMI builds are Phase 4 scope.

## Open Questions

- What Blender versions need to be supported simultaneously?
- Is there a minimum render volume that makes this cost-effective vs. RenderStreet's $60/mo unlimited?
- Should the worker support EEVEE rendering (CPU-only, cheaper instances) in addition to Cycles (GPU)?
