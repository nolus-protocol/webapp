# Translation Management System

> **Status**: Implemented in backend. Admin API requires `ADMIN_API_ENABLED=true` and valid `ADMIN_API_KEY`.

The Nolus webapp includes a comprehensive translation management system with AI-powered translation generation, approval workflows, and audit logging.

## Overview

The translation system supports:
- **Multiple languages** with configurable source language
- **AI-powered translation** using OpenAI GPT models
- **Approval workflow** with pending queue, review, and audit trail
- **Placeholder validation** to ensure translations preserve dynamic values
- **Glossary support** to keep technical terms untranslated
- **Batch operations** for efficient bulk processing

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Dashboard                           │
│  (Future: Vue component for translation management)          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Translation Admin API                           │
│  backend/src/handlers/translations.rs                        │
│  /api/admin/translations/*                                   │
│  ├── sync         - Detect missing translations             │
│  ├── missing      - List missing keys                       │
│  ├── generate     - AI translation generation               │
│  ├── pending      - Approval queue management               │
│  ├── active       - Direct locale editing                   │
│  ├── languages    - Language management                     │
│  └── audit        - Change history                          │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  OpenAI API     │  │  Translation    │  │  Locale Files   │
│  (configurable) │  │  Storage        │  │  (JSON)         │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Backend Implementation

### Handler: `backend/src/handlers/translations.rs`

The translation handler provides 13 admin endpoints:

| Handler | Endpoint | Purpose |
|---------|----------|---------|
| `sync_translations` | POST /admin/translations/sync | Detect missing keys |
| `list_missing` | GET /admin/translations/missing | List all missing keys |
| `generate_translations` | POST /admin/translations/generate | AI translation generation |
| `list_pending` | GET /admin/translations/pending | List pending translations |
| `get_pending` | GET /admin/translations/pending/:id | Get single pending |
| `approve_pending` | POST /admin/translations/pending/:id/approve | Approve translation |
| `reject_pending` | POST /admin/translations/pending/:id/reject | Reject translation |
| `edit_pending` | POST /admin/translations/pending/:id/edit | Edit and approve |
| `approve_batch` | POST /admin/translations/pending/approve-batch | Bulk approve |
| `get_active` | GET /admin/translations/active | Get active translations |
| `update_active` | PUT /admin/translations/active/:lang/:key | Direct edit |
| `list_languages` | GET /admin/translations/languages | List languages |
| `add_language` | POST /admin/translations/languages | Add new language |
| `get_audit_log` | GET /admin/translations/audit | Get audit entries |
| `get_key_history` | GET /admin/translations/key-history/:lang/:key | Key history |

### Supporting Modules

| Module | Purpose |
|--------|---------|
| `translations/storage.rs` | TranslationStorage for file operations |
| `translations/openai.rs` | OpenAIClient for AI translations |
| `translations/audit.rs` | AuditAction and audit logging |

## File Structure

```
backend/config/locales/
├── languages.json          # Language configuration
├── pending.json            # Pending translations queue
├── audit.json              # Audit log
└── active/
    ├── en.json             # English (source)
    ├── ru.json             # Russian
    ├── cn.json             # Chinese
    ├── fr.json             # French
    └── ...                 # Other languages
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for translation generation | Required for generation |
| `OPENAI_MODEL` | OpenAI model to use | `gpt-4o-mini` |
| `ADMIN_API_ENABLED` | Enable admin endpoints | `false` |
| `ADMIN_API_KEY` | Authentication key for admin API | Required if enabled |

### backend/.env Example

```env
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
ADMIN_API_ENABLED=true
ADMIN_API_KEY=your-secure-admin-key
```

## Data Models

### Pending Translation Status

```rust
pub enum PendingStatus {
    Pending,
    Approved,
    Rejected,
    Edited,
}
```

### Translation Source

```rust
pub enum TranslationSource {
    AiGenerated,
    Manual,
    Import,
}
```

### Audit Actions

```rust
pub enum AuditAction {
    Approve,
    Reject,
    Edit,
    BulkApprove,
    AddLanguage,
    Generate,
}
```

### Pending Translation

```rust
pub struct PendingTranslation {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub source_key: String,
    pub source_value: String,
    pub target_lang: String,
    pub proposed_value: String,
    pub placeholders: Vec<String>,
    pub placeholders_valid: bool,
    pub status: PendingStatus,
    pub reviewed_by: Option<String>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub edited_value: Option<String>,
    pub rejection_reason: Option<String>,
    pub source: TranslationSource,
    pub ai_model: Option<String>,
    pub batch_id: Option<String>,
}
```

## API Endpoints

### Sync & Detection

#### POST /admin/translations/sync

Detect missing keys across all languages.

**Response:**
```json
{
  "synced_at": "2026-01-31T12:00:00Z",
  "source_key_count": 150,
  "languages": [
    { "lang": "ru", "total_keys": 145, "missing_keys": 5, "pending_keys": 0 }
  ]
}
```

#### GET /admin/translations/missing

List all missing translation keys.

**Query Parameters:**
- `lang` - Filter by language (optional)

**Response:** Array of missing key results per language

### Generation

#### POST /admin/translations/generate

Generate AI translations for missing keys.

**Request:**
```json
{
  "lang": "ru",
  "keys": ["common.loading", "common.error"]  // Optional, empty = all missing
}
```

**Response:**
```json
{
  "batch_id": "uuid-batch-id",
  "lang": "ru",
  "total_keys": 5,
  "status": "completed"
}
```

**Status Values:**
- `completed` - Translations generated and added to pending queue
- `no_keys_to_translate` - No missing keys found

### Pending Translations

#### GET /admin/translations/pending

List pending translations awaiting approval.

**Query Parameters:**
- `lang` - Filter by language
- `status` - Filter by status (`pending`, `approved`, `rejected`, `edited`)
- `batch_id` - Filter by batch ID

**Response:** Array of `PendingTranslation` objects

#### GET /admin/translations/pending/:id

Get single pending translation details.

#### POST /admin/translations/pending/:id/approve

Approve a pending translation.

**Response:**
```json
{ "status": "approved", "id": "uuid" }
```

#### POST /admin/translations/pending/:id/reject

Reject a pending translation.

**Request:**
```json
{ "reason": "Incorrect context" }
```

**Response:**
```json
{ "status": "rejected", "id": "uuid" }
```

#### POST /admin/translations/pending/:id/edit

Edit and approve a pending translation.

**Request:**
```json
{ "value": "Corrected translation" }
```

**Response:**
```json
{ "status": "edited_and_approved", "id": "uuid" }
```

#### POST /admin/translations/pending/approve-batch

Bulk approve multiple pending translations.

**Request:**
```json
{ "ids": ["uuid1", "uuid2", "uuid3"] }
```

**Response:**
```json
{ "approved_count": 3 }
```

### Active Translations

#### GET /admin/translations/active

Get all active translations for a language.

**Query Parameters:**
- `lang` - Language code (required)

**Response:** Full locale JSON object

#### PUT /admin/translations/active/:lang/:key

Directly edit an active translation.

**Request:**
```json
{ "value": "Updated translation" }
```

**Response:**
```json
{ "status": "updated", "lang": "ru", "key": "common.loading" }
```

**Note:** Keys with dots should be URL-encoded (e.g., `common%2Eloading`)

### Language Management

#### GET /admin/translations/languages

List all configured languages with stats.

#### POST /admin/translations/languages

Add a new language.

**Request:**
```json
{
  "key": "de",
  "label": "Deutsch",
  "copy_from": "en"
}
```

**Response:**
```json
{ "status": "created", "key": "de", "label": "Deutsch" }
```

### Audit Log

#### GET /admin/translations/audit

Get audit log entries.

**Query Parameters:**
- `lang` - Filter by language
- `action` - Filter by action (`approve`, `reject`, `edit`, `bulk_approve`, `add_language`, `generate`)
- `limit` - Max entries (default: 100)

#### GET /admin/translations/key-history/:lang/:key

Get full history of a specific translation key.

## Workflow

### 1. Sync Missing Translations

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/translations/sync"
```

### 2. Generate AI Translations

```bash
# Generate all missing for a language
curl -X POST -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"lang": "ru"}' \
  "http://localhost:3000/api/admin/translations/generate"

# Generate specific keys only
curl -X POST -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"lang": "ru", "keys": ["common.loading", "common.error"]}' \
  "http://localhost:3000/api/admin/translations/generate"
```

### 3. Review Pending Translations

```bash
# List all pending
curl -H "Authorization: Bearer $ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/translations/pending"

# Filter by language
curl -H "Authorization: Bearer $ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/translations/pending?lang=ru"
```

### 4. Approve/Reject Translations

```bash
# Approve single
curl -X POST -H "Authorization: Bearer $ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/translations/pending/{id}/approve"

# Reject with reason
curl -X POST -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Incorrect context"}' \
  "http://localhost:3000/api/admin/translations/pending/{id}/reject"

# Edit and approve
curl -X POST -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"value": "Corrected translation"}' \
  "http://localhost:3000/api/admin/translations/pending/{id}/edit"

# Bulk approve
curl -X POST -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["id1", "id2", "id3"]}' \
  "http://localhost:3000/api/admin/translations/pending/approve-batch"
```

## Placeholders

The system automatically validates placeholders in translations. Supported formats:

| Format | Example | Description |
|--------|---------|-------------|
| `{name}` | `Hello, {name}!` | Named placeholder |
| `{0}`, `{1}` | `{0} of {1}` | Indexed placeholder |
| `%s`, `%d` | `%s items` | Printf-style |
| `{{var}}` | `{{count}} items` | Double-brace |

Translations with missing or extra placeholders will have `placeholders_valid: false` and should be reviewed carefully before approval.

## Glossary (Built-in)

The following terms are kept untranslated by default (hardcoded in `translations.rs`):

- **Protocol names**: Nolus, NLS, Cosmos, IBC
- **Cryptocurrency**: USDC, ATOM, OSMO
- **Technical terms**: DeFi, APR, TVL, LTV

## Translation Context

AI translations receive the following context (from `load_translation_context`):

```
Nolus is a DeFi money market protocol built on Cosmos SDK.

Key concepts:
- Lease: A leveraged position where users borrow to amplify exposure
- LTV (Loan-to-Value): Ratio of borrowed amount to total position value
- Liquidation: Automatic position closure when LTV exceeds threshold
- LPP (Liquidity Provider Pool): Pool that provides lending capital
- NLS: Native Nolus token used for governance and staking

Financial terms should maintain technical accuracy.
Keep translations concise and clear for UI elements.
```

## Frontend Integration

The frontend fetches translations from public endpoints:

```
GET /api/locales/{lang}        # Get translations for a language
```

Example usage in Vue:

```typescript
import { useI18n } from 'vue-i18n';

const { locale, setLocaleMessage } = useI18n();

// Load translations from backend
const response = await fetch('/api/locales/ru');
const messages = await response.json();
setLocaleMessage('ru', messages);
locale.value = 'ru';
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| "OpenAI API key not configured" | Missing `OPENAI_API_KEY` | Set environment variable |
| "No source language configured" | Missing source language in `languages.json` | Configure source language |
| "lang query parameter is required" | Missing `lang` param on GET /active | Add `?lang=xx` to request |
| "Invalid key encoding" | Malformed URL-encoded key | Properly encode dots as `%2E` |

## Security

- All admin endpoints require Bearer token authentication (`ADMIN_API_KEY`)
- Admin API must be explicitly enabled (`ADMIN_API_ENABLED=true`)
- Audit log tracks all changes with timestamps
- Consider IP allowlisting for admin endpoints in production

## File References

| File | Purpose |
|------|---------|
| `backend/src/handlers/translations.rs` | HTTP endpoint handlers |
| `backend/src/translations/storage.rs` | TranslationStorage implementation |
| `backend/src/translations/openai.rs` | OpenAIClient for AI translations |
| `backend/src/translations/audit.rs` | Audit logging |
| `backend/config/locales/` | Locale file storage |
