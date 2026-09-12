-- ============================================================
-- Row Level Security Policies for Secure Sheets
-- These policies are the LAST LINE OF DEFENSE for multi-tenancy.
-- Even if application code has a bug, these policies block cross-tenant access.
-- ============================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE workbook_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cell_history ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners too (important!)
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
ALTER TABLE workbooks FORCE ROW LEVEL SECURITY;
ALTER TABLE sheets FORCE ROW LEVEL SECURITY;
ALTER TABLE workbook_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE sheet_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE cell_history FORCE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: current organization ids the user belongs to
-- We set app.current_user_id and app.current_org_ids via SET LOCAL
-- in every request (from NestJS middleware / interceptor)
-- ============================================================

-- Organizations: user can only see orgs they are a member of
CREATE POLICY org_select ON organizations
  FOR SELECT
  USING (
    id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

CREATE POLICY org_insert ON organizations
  FOR INSERT
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
  );

CREATE POLICY org_update ON organizations
  FOR UPDATE
  USING (
    id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
    AND current_setting('app.is_org_admin', true) = 'true'
  );

-- Organization Members
CREATE POLICY org_members_select ON organization_members
  FOR SELECT
  USING (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

CREATE POLICY org_members_insert ON organization_members
  FOR INSERT
  WITH CHECK (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
    AND current_setting('app.is_org_admin', true) = 'true'
  );

CREATE POLICY org_members_delete ON organization_members
  FOR DELETE
  USING (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
    AND current_setting('app.is_org_admin', true) = 'true'
  );

-- Workbooks
CREATE POLICY workbooks_select ON workbooks
  FOR SELECT
  USING (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
  );

CREATE POLICY workbooks_insert ON workbooks
  FOR INSERT
  WITH CHECK (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
  );

CREATE POLICY workbooks_update ON workbooks
  FOR UPDATE
  USING (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
  );

CREATE POLICY workbooks_delete ON workbooks
  FOR DELETE
  USING (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
    AND current_setting('app.is_org_admin', true) = 'true'
  );

-- Sheets
CREATE POLICY sheets_select ON sheets
  FOR SELECT
  USING (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
  );

CREATE POLICY sheets_insert ON sheets
  FOR INSERT
  WITH CHECK (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
  );

CREATE POLICY sheets_update ON sheets
  FOR UPDATE
  USING (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
  );

CREATE POLICY sheets_delete ON sheets
  FOR DELETE
  USING (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
  );

-- Workbook Permissions
CREATE POLICY wb_perm_select ON workbook_permissions
  FOR SELECT
  USING (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
  );

CREATE POLICY wb_perm_insert ON workbook_permissions
  FOR INSERT
  WITH CHECK (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
    AND current_setting('app.is_org_admin', true) = 'true'
  );

CREATE POLICY wb_perm_update ON workbook_permissions
  FOR UPDATE
  USING (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
    AND current_setting('app.is_org_admin', true) = 'true'
  );

CREATE POLICY wb_perm_delete ON workbook_permissions
  FOR DELETE
  USING (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
    AND current_setting('app.is_org_admin', true) = 'true'
  );

-- Sheet Permissions
CREATE POLICY sheet_perm_select ON sheet_permissions
  FOR SELECT
  USING (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
  );

CREATE POLICY sheet_perm_insert ON sheet_permissions
  FOR INSERT
  WITH CHECK (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
    AND current_setting('app.is_org_admin', true) = 'true'
  );

CREATE POLICY sheet_perm_update ON sheet_permissions
  FOR UPDATE
  USING (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
    AND current_setting('app.is_org_admin', true) = 'true'
  );

CREATE POLICY sheet_perm_delete ON sheet_permissions
  FOR DELETE
  USING (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
    AND current_setting('app.is_org_admin', true) = 'true'
  );

-- Audit Logs (read-only for most users, insert only via service role)
CREATE POLICY audit_select ON audit_logs
  FOR SELECT
  USING (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- Note: Inserts into audit_logs should normally be done with a privileged connection
-- or by temporarily setting a bypass. Application code will handle this carefully.

-- Cell History
CREATE POLICY cell_history_select ON cell_history
  FOR SELECT
  USING (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
  );

CREATE POLICY cell_history_insert ON cell_history
  FOR INSERT
  WITH CHECK (
    organization_id::text = ANY (string_to_array(current_setting('app.current_org_ids', true), ','))
  );

-- ============================================================
-- IMPORTANT NOTES FOR APPLICATION CODE
-- ============================================================
-- On every request the NestJS middleware MUST run:
--
--   SET LOCAL app.current_user_id = '<userId>';
--   SET LOCAL app.current_org_ids = '<orgId1,orgId2,...>';
--   SET LOCAL app.is_platform_admin = 'true' | 'false';
--   SET LOCAL app.is_org_admin = 'true' | 'false';
--
-- Use a transaction or Prisma $executeRaw for this.
-- Never trust the client for these values.
