# Lessons Learned

Gotchas encountered during development. Reference this before making similar changes.

---

## CI/CD & GitHub Actions

### Workload Identity Federation (WIF)
- **Always include `service_account`** in google-github-actions/auth
- Without it, auth succeeds but you get no permissions
```yaml
- uses: google-github-actions/auth@v2
  with:
    project_id: ${{ vars.GCP_PROJECT_ID }}
    workload_identity_provider: projects/${{ vars.GCP_PROJECT_NUMBER }}/...
    service_account: my-sa@${{ vars.GCP_PROJECT_ID }}.iam.gserviceaccount.com  # Required!
```

### gcloud CLI vs Client Libraries
- `create_credentials_file: false` only works for Google client libraries
- **gcloud CLI requires the credentials file** - needs `actions/checkout` before auth

### UV Dependency Caching
```yaml
- uses: astral-sh/setup-uv@v5
  with:
    enable-cache: true
    cache-dependency-glob: "backend/uv.lock"
```

---

## Python / UV

### Dev Dependencies
- Use `[dependency-groups]` (PEP 735), not `[project.optional-dependencies]`
- `--dev` flag works with dependency-groups
- `--all-extras` or `--extra name` for optional-dependencies

```toml
# Correct - for dev tools
[dependency-groups]
dev = ["ruff", "mypy", "pydantic-to-typescript2"]

# Wrong - this is for package extras like pip install pkg[extra]
[project.optional-dependencies]
dev = [...]
```

---

## Frontend / Next.js

### Bun Lock File
- Lock file is `bun.lock`, not `bun.lockb`

### Turbopack Monorepo Builds
- Docker builds fail with "couldn't find next/package.json"
- Fix: Add `turbopack.root` to next.config.ts
```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: "..",  // Points to monorepo root
  },
};
```

### Docker Build Context
- Frontend Dockerfile needs root `package.json` in builder stage for workspace resolution
```dockerfile
COPY package.json ./  # Needed for monorepo resolution
```

---

## Terraform / GCP

### Docker Image Tagging Strategy
- **Push both SHA and `:latest` tags** — traceability + stable reference
- SHA tag: rollback capability, audit trail
- Latest tag: Terraform can reference stable path
```yaml
docker build -t $IMAGE:${{ github.sha }} -t $IMAGE:latest .
docker push $IMAGE:${{ github.sha }}
docker push $IMAGE:latest
```

### Chicken-and-Egg: Cloud Run + Artifact Registry (Initial Setup Only)
- First `terraform apply`: Use placeholder images (real images don't exist yet)
- After first CI/CD run: Update Terraform to use real image paths with `:latest`
- Subsequent applies use the real images

### WIF Provider Path
- Uses project NUMBER (numeric), not project ID (string)
- `projects/123456789/locations/global/workloadIdentityPools/...`

### Cloud Run Jobs
- Must exist before `gcloud run jobs execute` can run
- Use `continue-on-error: true` for migration jobs until created

---

*Updated: 2026-01-22*
