# Security Model

## Current Protection

✅ **Private Key Security**
- Private signing key is stored in GitHub Secrets (`STONE_LEDGER_PRIVATE_KEY_B64`)
- Only repository owners/admins can access GitHub Secrets
- Private key never appears in logs or code

✅ **Workflow Restrictions**
- Workflow can only be triggered by repository owner
- Workflow only runs on `main` branch
- All entries are cryptographically signed

## Security Recommendations

### 1. Repository Settings

**Required Settings:**
- ✅ Repository must be **private** OR have strict branch protection
- ✅ Branch protection on `main`:
  - Require pull request reviews
  - Require status checks
  - Restrict who can push to matching branches
  - Allow GitHub Actions to bypass (for the workflow)

**Recommended Settings:**
- ✅ Disable "Allow GitHub Actions to create and approve pull requests" for non-admin users
- ✅ Enable "Require approval for all outside collaborators"
- ✅ Set "Workflow permissions" to "Read and write permissions" but restrict who can trigger workflows

### 2. Workflow Access Control

The workflow includes checks to ensure only the repository owner can trigger it:

```yaml
if: github.event_name == 'workflow_dispatch' && (github.actor == 'stoneplatforms' || github.event.workflow_dispatch.actor == github.repository_owner)
```

### 3. Additional Security Measures

**For Production Use:**

1. **Use GitHub App Authentication** (Recommended)
   - Create a GitHub App with limited permissions
   - Use app authentication instead of workflow_dispatch
   - More granular control over who can create entries

2. **Add Entry Validation**
   - Validate entry content before signing
   - Check for duplicate entry_ids
   - Validate subject_ref format
   - Rate limiting

3. **Audit Logging**
   - Log all entry creation attempts
   - Track who triggered each workflow
   - Monitor for suspicious activity

4. **Two-Factor Authentication**
   - Require 2FA for all repository admins
   - Use GitHub's 2FA requirement settings

### 4. API-Based Entry Creation (Future)

For programmatic entry creation, consider:

- **Repository Dispatch Events**: More secure than workflow_dispatch
- **GitHub App Webhooks**: Receive entries from external systems
- **OAuth Tokens**: Authenticate external services
- **IP Whitelisting**: Restrict API access to known IPs

## Current Limitations

⚠️ **Manual Workflow Trigger**
- Currently uses `workflow_dispatch` which can be triggered via GitHub UI or API
- Anyone with write access to the repo could theoretically trigger it
- The workflow checks actor permissions, but this relies on GitHub's access control

⚠️ **No Entry Content Validation**
- Workflow signs whatever payload is provided
- Consider adding validation rules for entry content

## Best Practices

1. **Keep Repository Private** (if possible)
   - Prevents unauthorized access to workflow triggers
   - Limits who can see the private key secret name

2. **Monitor Workflow Runs**
   - Review all workflow runs regularly
   - Set up alerts for unexpected entries

3. **Rotate Keys Periodically**
   - Generate new keypairs periodically
   - Update GitHub Secrets
   - Keep old keys in registry for verification

4. **Use Separate Environments**
   - Test entries in a separate test repository
   - Only production entries go to main ledger

## Verification

Anyone can verify entries are legitimate by:
1. Checking the signature matches the public key
2. Verifying the entry hasn't been modified
3. Confirming the entry_id is unique
4. Validating the canonical JSON format

**The ledger is append-only** - once an entry is committed, it cannot be modified without detection (signature verification will fail).
