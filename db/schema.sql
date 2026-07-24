-- Move Relay — provenance-aware schema
-- The database is the source of truth. Not XState, not frontend state.
-- Every consequential transition is enforced here by constraint, not by convention.

BEGIN;

-- No pgcrypto. gen_random_uuid() has been in Postgres core since 13, so
-- requiring the extension bought nothing and cost portability: it is absent from
-- PGlite, which is what lets this schema run with no Docker and no server.

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------

CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partners are referral sources. Public evidence: utilityconnect.net/partnership
-- collects Domain Name, Theme Color and Company Logo, i.e. white-label microsites.
CREATE TABLE partners (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  domain          TEXT,                    -- white-label host, may be NULL
  theme_color     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

-- ---------------------------------------------------------------------------
-- Channels and raw intake
-- ---------------------------------------------------------------------------

-- Every inbound payload is stored verbatim and never mutated. Field values are
-- derived from these rows; these rows are the evidence. If we cannot point at a
-- raw_submission, we do not know the fact.
CREATE TYPE channel_type AS ENUM (
  'partner_api', 'csv_upload', 'customer_form', 'microsite', 'concierge_manual'
);

CREATE TABLE raw_submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  partner_id       UUID REFERENCES partners(id),
  channel          channel_type NOT NULL,
  payload          JSONB NOT NULL,
  payload_hash     TEXT NOT NULL,          -- sha256 of canonicalised payload
  correlation_id   UUID NOT NULL,
  received_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_ip        TEXT,
  -- Same exact payload on the same channel is one submission, not two.
  UNIQUE (organization_id, channel, payload_hash)
);

CREATE INDEX raw_submissions_correlation_idx ON raw_submissions (correlation_id);

-- ---------------------------------------------------------------------------
-- Canonical records
-- ---------------------------------------------------------------------------

CREATE TYPE move_state AS ENUM (
  'intake', 'conflict_pending', 'canonical', 'in_service', 'completed', 'cancelled'
);

CREATE TABLE moves (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reference        TEXT NOT NULL,           -- human-facing, e.g. MR-2026-0001
  state            move_state NOT NULL DEFAULT 'intake',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, reference)
);

-- ---------------------------------------------------------------------------
-- Field-level provenance — the core of the product
-- ---------------------------------------------------------------------------

-- Verification is a property of HOW we learned a value, not of the value itself.
CREATE TYPE verification_level AS ENUM (
  'unverified',          -- asserted by a third party, never confirmed
  'customer_confirmed',  -- the customer themselves stated it
  'system_validated',    -- passed a deterministic check (e.g. USPS address)
  'human_approved'       -- a named operator approved it
);

-- Every value ever held for every field. Append-only. Nothing is updated in place.
CREATE TABLE field_versions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  move_id            UUID NOT NULL REFERENCES moves(id) ON DELETE CASCADE,
  field_path         TEXT NOT NULL,        -- 'customer.phone', 'move.date'
  value              JSONB NOT NULL,
  raw_submission_id  UUID REFERENCES raw_submissions(id),
  channel            channel_type NOT NULL,
  partner_id         UUID REFERENCES partners(id),
  verification       verification_level NOT NULL DEFAULT 'unverified',
  confidence         NUMERIC(3,2) NOT NULL DEFAULT 0.50
                       CHECK (confidence >= 0 AND confidence <= 1),
  supersedes_id      UUID REFERENCES field_versions(id),
  is_canonical       BOOLEAN NOT NULL DEFAULT FALSE,
  selected_by        TEXT,                 -- actor id; NULL until chosen
  selection_reason   TEXT,
  recorded_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX field_versions_move_field_idx
  ON field_versions (move_id, field_path, recorded_at DESC);

-- Exactly one canonical value per field per move. Enforced by the database, so a
-- race between two approvals cannot produce two truths.
CREATE UNIQUE INDEX field_versions_one_canonical_idx
  ON field_versions (move_id, field_path) WHERE is_canonical;

-- A canonical value must have been chosen by someone. AI may explain a conflict;
-- it may never perform the merge. This constraint is that rule, in the schema.
ALTER TABLE field_versions ADD CONSTRAINT canonical_requires_actor
  CHECK (NOT is_canonical OR selected_by IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Consent — scoped, timestamped, revocable
-- ---------------------------------------------------------------------------

-- Public consent wording at /connect scopes contact to four named purposes.
-- A boolean column cannot express that, so we do not use one.
CREATE TYPE consent_purpose AS ENUM (
  'customer_care', 'connection_status', 'account_information', 'appointment_details'
);

CREATE TYPE consent_channel AS ENUM ('phone', 'sms', 'email');

CREATE TABLE consent_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  move_id            UUID NOT NULL REFERENCES moves(id) ON DELETE CASCADE,
  purpose            consent_purpose NOT NULL,
  channel            consent_channel NOT NULL,
  granted            BOOLEAN NOT NULL,
  consent_text_version TEXT NOT NULL,      -- which wording they actually agreed to
  raw_submission_id  UUID REFERENCES raw_submissions(id),
  occurred_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX consent_events_lookup_idx
  ON consent_events (move_id, purpose, channel, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Provider interaction — we are a facilitator, not the system of record
-- ---------------------------------------------------------------------------

-- Public ToS: "You are not purchasing or ordering products or services from
-- Utility Connect, LLC when you order a service." The provider owns order truth.
-- UNKNOWN is therefore a first-class state, not an error state.
CREATE TYPE submission_state AS ENUM (
  'pending', 'submitted', 'confirmed', 'failed', 'unknown', 'reconciled', 'duplicate'
);

CREATE TABLE service_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  move_id          UUID NOT NULL REFERENCES moves(id) ON DELETE CASCADE,
  service_type     TEXT NOT NULL,          -- electric, internet, security, ...
  provider_name    TEXT NOT NULL,
  state            submission_state NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (move_id, service_type, provider_name)
);

CREATE TABLE provider_submissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_request_id  UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  operation_key       TEXT NOT NULL,       -- stable across retries of one intent
  request_fingerprint TEXT NOT NULL,
  state               submission_state NOT NULL DEFAULT 'pending',
  provider_order_id   TEXT,                -- populated on confirm or reconcile
  attempt             INT NOT NULL DEFAULT 1,
  request_payload     JSONB NOT NULL,
  response_payload    JSONB,
  error_category      TEXT,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at          TIMESTAMPTZ
);

-- One row per intent. A retry updates this row; it never inserts a second one.
-- This is what makes a blind retry structurally impossible rather than merely
-- discouraged. Survives restart and cache eviction, unlike a Redis lock.
CREATE UNIQUE INDEX provider_submissions_operation_key_idx
  ON provider_submissions (organization_id, operation_key);

-- A submission may only claim a provider order id in a state where that is meaningful.
ALTER TABLE provider_submissions ADD CONSTRAINT order_id_requires_settled_state
  CHECK (provider_order_id IS NULL OR state IN ('confirmed', 'reconciled', 'duplicate'));

CREATE TABLE idempotency_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  operation_key    TEXT NOT NULL,
  fingerprint      TEXT NOT NULL,
  state            TEXT NOT NULL,          -- in_flight | completed | unknown
  stored_response  JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, operation_key)
);

CREATE TABLE reconciliation_jobs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_submission_id UUID NOT NULL REFERENCES provider_submissions(id) ON DELETE CASCADE,
  reason                 TEXT NOT NULL,    -- 'timeout_unknown_outcome'
  outcome                TEXT,             -- 'found_existing' | 'not_found' | 'ambiguous'
  found_order_id         TEXT,
  attempts               INT NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at           TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- AI artifacts — recorded, never authoritative
-- ---------------------------------------------------------------------------

CREATE TABLE ai_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  move_id           UUID REFERENCES moves(id) ON DELETE CASCADE,
  purpose           TEXT NOT NULL,         -- 'concierge_briefing' | 'conflict_explanation'
  model             TEXT NOT NULL,
  prompt_version    TEXT NOT NULL,
  input_field_ids   UUID[] NOT NULL,       -- exactly which field_versions were shown
  output            JSONB NOT NULL,
  grounded          BOOLEAN NOT NULL,      -- did every claim cite an input field?
  human_decision    TEXT,                  -- 'accepted' | 'edited' | 'rejected'
  human_actor       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- An AI run never sets state. It is evidence of advice, alongside what the human did.

-- ---------------------------------------------------------------------------
-- Audit — append only
-- ---------------------------------------------------------------------------

CREATE TABLE audit_events (
  id               BIGSERIAL PRIMARY KEY,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  move_id          UUID REFERENCES moves(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,
  actor            TEXT NOT NULL,          -- 'system' | 'ai:<run_id>' | 'human:<id>'
  correlation_id   UUID,
  causation_id     UUID,
  state_before     JSONB,
  state_after      JSONB,
  detail           JSONB,
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_move_idx ON audit_events (move_id, occurred_at);
CREATE INDEX audit_events_correlation_idx ON audit_events (correlation_id);

-- Audit rows are immutable. Enforced, not merely intended.
CREATE RULE audit_events_no_update AS ON UPDATE TO audit_events DO INSTEAD NOTHING;
CREATE RULE audit_events_no_delete AS ON DELETE TO audit_events DO INSTEAD NOTHING;

COMMIT;
